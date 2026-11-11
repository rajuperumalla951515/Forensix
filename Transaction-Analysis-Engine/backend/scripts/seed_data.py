import random
from datetime import datetime, timedelta, timezone
from app.database.postgres import SessionLocal, Base, engine
from app.models.entities import Customer, Transaction, Alert, FraudCase
from app.core.bootstrap import ensure_demo_users
from app.services.graph_service import save_transfer_edge
from app.models.enums import RiskLevel, TransactionStatus, AlertSeverity, AlertStatus, CaseStatus, CustomerStatus


COUNTRIES = ["US", "GB", "NG", "CN", "RU", "BR", "IN", "KE", "UA", "DE", "FR", "MX", "JP", "AU"]
CHANNELS = ["Online Banking", "Mobile App", "ATM", "Wire Transfer", "POS Terminal", "ACH"]
FIRST_NAMES = ["James", "Maria", "Chen", "Amara", "Ivan", "Sofia", "Ahmed", "Priya", "Lucas", "Yuki"]
LAST_NAMES = ["Smith", "Garcia", "Wang", "Osei", "Petrov", "Rossi", "Hassan", "Patel", "Johnson", "Torres"]


def rid(prefix: str):
    return f"{prefix}-{random.randint(100000, 999999)}"


def random_date(days_back: int):
    now = datetime.now(timezone.utc)
    return now - timedelta(days=random.randint(0, days_back), hours=random.randint(0, 23), minutes=random.randint(0, 59))


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_demo_users(db)
        db.query(FraudCase).delete()
        db.query(Alert).delete()
        db.query(Transaction).delete()
        db.query(Customer).delete()
        db.commit()

        customers = []
        accounts = []
        for i in range(40):
            cid = rid("CUST")
            account = f"ACC{random.randint(1000000000, 9999999999)}"
            level = random.choice([RiskLevel.low, RiskLevel.low, RiskLevel.medium, RiskLevel.high, RiskLevel.critical])
            score = random.uniform(0, 30) if level == RiskLevel.low else random.uniform(30, 60) if level == RiskLevel.medium else random.uniform(60, 80) if level == RiskLevel.high else random.uniform(80, 99)
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            db.add(
                Customer(
                    id=cid,
                    name=name,
                    email=f"{name.lower().replace(' ', '.')}{i}@email.com",
                    account_number=account,
                    risk_level=level,
                    risk_score=round(score, 1),
                    status=random.choice([CustomerStatus.active, CustomerStatus.under_review, CustomerStatus.suspended]),
                    total_transactions=random.randint(5, 200),
                    flagged_transactions=random.randint(0, 15),
                    country=random.choice(COUNTRIES),
                    joined_at=random_date(1000),
                )
            )
            customers.append(cid)
            accounts.append(account)

        tx_ids = []
        for _ in range(120):
            frm = random.randrange(len(customers))
            to = random.randrange(len(customers))
            while to == frm:
                to = random.randrange(len(customers))
            tid = rid("TXN")
            tx_ids.append(tid)
            risk = random.choice([RiskLevel.low, RiskLevel.medium, RiskLevel.high, RiskLevel.critical])
            status = (
                random.choice([TransactionStatus.flagged, TransactionStatus.blocked])
                if risk == RiskLevel.critical
                else random.choice([TransactionStatus.flagged, TransactionStatus.pending])
                if risk == RiskLevel.high
                else random.choice([TransactionStatus.cleared, TransactionStatus.flagged, TransactionStatus.pending])
            )
            db.add(
                Transaction(
                    id=tid,
                    tx_hash=f"0x{random.getrandbits(256):064x}",
                    from_account=accounts[frm],
                    to_account=accounts[to],
                    from_customer_id=customers[frm],
                    to_customer_id=customers[to],
                    amount=round(random.uniform(100, 95000), 2),
                    currency=random.choice(["USD", "USD", "EUR", "GBP", "JPY"]),
                    status=status,
                    risk_level=risk,
                    risk_score=round(random.uniform(0, 99), 1),
                    description=random.choice(["International wire transfer", "POS purchase", "Online payment", "Peer-to-peer transfer"]),
                    timestamp=random_date(90),
                    country=random.choice(COUNTRIES),
                    channel=random.choice(CHANNELS),
                )
            )

        for _ in range(60):
            db.add(
                Alert(
                    id=rid("ALT"),
                    title=random.choice(["Suspicious large transfer detected", "Unusual account activity", "Cross-border transfer anomaly"]),
                    description=random.choice(["Amount exceeds normal behavior.", "Rapid transfers to new payees.", "Pattern matches known fraud signature."]),
                    severity=random.choice([AlertSeverity.low, AlertSeverity.medium, AlertSeverity.high, AlertSeverity.critical]),
                    status=random.choice([AlertStatus.open, AlertStatus.investigating, AlertStatus.resolved, AlertStatus.dismissed]),
                    transaction_id=random.choice(tx_ids),
                    customer_id=random.choice(customers),
                    timestamp=random_date(30),
                    rule_triggered=random.choice(["RULE-001", "RULE-002", "RULE-003"]),
                )
            )

        for i in range(25):
            db.add(
                FraudCase(
                    id=rid("CASE"),
                    case_number=f"FR-2026-{1000 + i:04d}",
                    title=random.choice(["Money laundering investigation", "Account takeover fraud", "Identity theft case"]),
                    status=random.choice([CaseStatus.open, CaseStatus.investigating, CaseStatus.pending_review, CaseStatus.closed, CaseStatus.escalated]),
                    priority=random.choice([RiskLevel.low, RiskLevel.medium, RiskLevel.high, RiskLevel.critical]),
                    assignee=random.choice(["Alice Chen", "Bob Martinez", "Carol White", "David Kim"]),
                    customer_id=random.choice(customers),
                    customer_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                    total_amount=round(random.uniform(10000, 500000), 2),
                    transaction_count=random.randint(2, 20),
                    created_at=random_date(60),
                    updated_at=random_date(10),
                )
            )
        db.commit()

        for t in db.query(Transaction).all():
            save_transfer_edge(t.id, t.from_account, t.to_account, t.amount, t.status.value, t.risk_level.value)

        print("Seed complete (PostgreSQL + Neo4j graph edges).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
