from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

HIGH_RISK_COUNTRIES = {"IR", "KP", "SY", "CU", "SD", "YE", "LY", "SO", "MM", "AF"}
HIGH_RISK_CHANNELS = {"crypto", "bitcoin", "anonymous", "cash", "hawala", "dark"}
ROUND_AMOUNTS = {1000, 2000, 5000, 10000, 25000, 50000, 100000, 500000}


@dataclass
class RiskResult:
    score: float
    level: str
    status: str
    flags: list[str]


def _hour_from_ts(timestamp: str) -> float:
    if not timestamp:
        return 12.0
    try:
        return float(datetime.fromisoformat(timestamp.replace("Z", "+00:00")).hour)
    except ValueError:
        return 12.0


def _feature_vector(
    amount: float,
    country: str,
    channel: str,
    timestamp: str,
    from_account: str,
    to_account: str,
    description: str,
) -> list[float]:
    country_code = (country or "").upper()[:2]
    ch = (channel or "").lower()
    desc = (description or "").lower()
    return [
        float(np.log1p(max(amount, 0))),
        1.0 if country_code in HIGH_RISK_COUNTRIES else 0.0,
        1.0 if any(m in ch for m in HIGH_RISK_CHANNELS) else 0.0,
        _hour_from_ts(timestamp) / 24.0,
        float(len(from_account or "")) / 40.0,
        float(len(to_account or "")) / 40.0,
        1.0 if from_account and to_account and from_account == to_account else 0.0,
        float(sum(1 for w in ("urgent", "offshore", "gift", "lottery") if w in desc)),
    ]


def isolation_forest_boosts(rows: list[dict]) -> list[float]:
    """Return 0–25 point boosts from Isolation Forest (higher = more anomalous)."""
    n = len(rows)
    if n < 4:
        return [0.0] * n
    X = np.array(
        [
            _feature_vector(
                abs(float(r.get("amount") or 0)),
                str(r.get("country") or ""),
                str(r.get("channel") or ""),
                str(r.get("timestamp") or ""),
                str(r.get("fromAccount") or ""),
                str(r.get("toAccount") or ""),
                str(r.get("description") or ""),
            )
            for r in rows
        ]
    )
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    contamination = min(0.2, max(0.02, 4.0 / n))
    clf = IsolationForest(
        n_estimators=120,
        contamination=contamination,
        random_state=42,
    )
    clf.fit(Xs)
    # score_samples: higher = more normal; we want boost when lower
    raw = clf.score_samples(Xs)
    inv = -raw
    lo, hi = inv.min(), inv.max()
    if hi - lo < 1e-9:
        return [0.0] * n
    norm = (inv - lo) / (hi - lo)
    return (norm * 25.0).tolist()


def compute_risk(
    amount: float,
    currency: str,
    description: str,
    country: str,
    channel: str,
    timestamp: str,
    from_account: str,
    to_account: str,
    ml_boost: float = 0.0,
) -> RiskResult:
    score = 0.0
    flags: list[str] = []

    if amount > 500000:
        score += 60
        flags.append("Extremely large transfer (>$500K)")
    elif amount > 100000:
        score += 50
        flags.append("Very large transfer (>$100K)")
    elif amount > 50000:
        score += 40
        flags.append("Large transfer (>$50K)")
    elif amount > 10000:
        score += 28
        flags.append("Elevated transfer amount (>$10K)")
    elif amount > 1000:
        score += 15
        flags.append("Amount exceeds $1,000 threshold")
    elif amount > 500:
        score += 5

    if amount in ROUND_AMOUNTS or (amount > 1000 and amount % 1000 == 0):
        score += 8
        flags.append("Suspiciously round amount")

    country_code = (country or "").upper()[:2]
    if country_code and country_code in HIGH_RISK_COUNTRIES:
        score += 25
        flags.append(f"High-risk country: {country_code}")

    ch = (channel or "").lower()
    for marker in HIGH_RISK_CHANNELS:
        if marker in ch:
            score += 20
            flags.append(f"High-risk channel: {channel}")
            break

    if timestamp:
        try:
            hour = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).hour
            if 1 <= hour <= 5:
                score += 10
                flags.append("Off-hours transaction (1-5 AM)")
        except ValueError:
            pass

    desc = (description or "").lower()
    suspicious_words = {
        "urgent",
        "secret",
        "private",
        "offshore",
        "tax",
        "avoid",
        "gift",
        "lottery",
        "prize",
        "investment",
    }
    for word in suspicious_words:
        if word in desc:
            score += 8
            flags.append(f'Suspicious keyword: "{word}"')
            break

    if from_account and to_account and from_account == to_account:
        score += 30
        flags.append("Self-transfer detected (potential layering)")

    if currency and currency.upper() != "USD" and amount > 5000:
        score += 5
        flags.append(f"Foreign currency transfer ({currency.upper()})")

    if ml_boost > 0:
        score += ml_boost
        flags.append(f"Anomaly model adjustment (+{ml_boost:.0f})")

    score = min(99, max(0, round(score, 1)))

    if score >= 80:
        level = "critical"
        status = "blocked"
    elif score >= 60:
        level = "high"
        status = "flagged"
    elif score >= 35:
        level = "medium"
        status = "flagged" if amount > 1000 else "cleared"
    else:
        level = "low"
        status = "flagged" if amount > 1000 else "cleared"

    if not flags:
        flags.append("No significant risk factors detected")

    return RiskResult(score=score, level=level, status=status, flags=flags)
