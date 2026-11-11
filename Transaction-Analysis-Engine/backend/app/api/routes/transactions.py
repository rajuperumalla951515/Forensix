import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import Alert, Customer, Transaction, User
from app.models.enums import AlertSeverity, AlertStatus, CustomerStatus, RiskLevel, TransactionStatus
from app.services.fraud_service import compute_risk, isolation_forest_boosts
from app.services.graph_service import save_transfer_edge
from app.utils.serializers import as_tx

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("")
def list_transactions(
    status: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if status and status != "all":
        q = q.filter(Transaction.status == TransactionStatus(status))
    if riskLevel and riskLevel != "all":
        q = q.filter(Transaction.risk_level == RiskLevel(riskLevel))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Transaction.tx_hash.ilike(like))
            | (Transaction.from_account.ilike(like))
            | (Transaction.to_account.ilike(like))
            | (Transaction.description.ilike(like))
        )
    total = q.count()
    rows = q.order_by(desc(Transaction.timestamp)).offset((page - 1) * limit).limit(limit).all()
    return {"data": [as_tx(t) for t in rows], "total": total, "page": page, "limit": limit}


@router.get("/{tx_id}")
def get_transaction(tx_id: str, _user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return as_tx(tx)


@router.post("/import-csv")
def import_csv(payload: dict = Body(...), _user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows_in = payload.get("transactions", [])
    if not isinstance(rows_in, list) or not rows_in:
        raise HTTPException(status_code=400, detail="No transactions provided")

#     normalized = []
#     for row in rows_in:
#         amount = abs(float(row.get("amount") or 0))
#         from_account = str(row.get("fromAccount") or "UNKNOWN").strip()
#         to_account = str(row.get("toAccount") or "UNKNOWN").strip()
#         if amount <= 0 or from_account == "UNKNOWN" or to_account == "UNKNOWN":
#             continue
#         normalized.append(
#             {
#                 "fromAccount": from_account,
#                 "toAccount": to_account,
#                 "amount": amount,
#                 "currency": str(row.get("currency") or "USD").upper()[:3],
#                 "description": str(row.get("description") or ""),
#                 "country": str(row.get("country") or ""),
#                 "channel": str(row.get("channel") or "CSV Import"),
#                 "timestamp": str(row.get("timestamp") or ""),
#             }
#         )

#     if not normalized:
#         raise HTTPException(status_code=400, detail="No valid transactions after validation")

#     ml_boosts = isolation_forest_boosts(normalized)
#     sender_freq: dict[str, int] = {}
#     for r in normalized:
#         sender_freq[r["fromAccount"]] = sender_freq.get(r["fromAccount"], 0) + 1

#     saved = []
#     alerts = []
#     node_map: dict[str, dict] = {}
#     edges: list[dict] = []

#     for i, row in enumerate(normalized):
#         amount = row["amount"]
#         from_account = row["fromAccount"]
#         to_account = row["toAccount"]
#         currency = row["currency"]
#         description = row["description"]
#         country = row["country"]
#         channel = row["channel"]
#         timestamp = row["timestamp"]
#         ml_b = ml_boosts[i] if i < len(ml_boosts) else 0.0

#         risk = compute_risk(
#             amount=amount,
#             currency=currency,
#             description=description,
#             country=country,
#             channel=channel,
#             timestamp=timestamp,
#             from_account=from_account,
#             to_account=to_account,
#             ml_boost=ml_b,
#         )
#         freq = sender_freq.get(from_account, 1)
#         if freq >= 5:
#             risk.score = min(99, risk.score + 12)
#             risk.flags.append(f"High transaction velocity ({freq} from same account)")
#         elif freq >= 3:
#             risk.score = min(99, risk.score + 6)
#             risk.flags.append(f"Elevated transaction frequency ({freq} from same account)")
#         risk.level = "critical" if risk.score >= 80 else "high" if risk.score >= 60 else "medium" if risk.score >= 35 else "low"
#         risk.status = "blocked" if risk.score >= 80 else "flagged" if risk.score >= 60 or amount > 1000 else "cleared"

#         tx_id = f"CSV-{uuid.uuid4().hex[:12].upper()}"
#         from_customer_id = f"CUST-{''.join(ch for ch in from_account if ch.isalnum())[:10].upper()}"
#         to_customer_id = f"CUST-{''.join(ch for ch in to_account if ch.isalnum())[:10].upper()}"

#         # for cid, acct in [(from_customer_id, from_account), (to_customer_id, to_account)]:
#         #     if not db.get(Customer, cid):
#         #         db.add(
#         #             Customer(
#         for cid, acct in [(from_customer_id, from_account), (to_customer_id, to_account)]:
#             if not db.get(Customer, cid):
#                 db.add(
#                     Customer(
#                         id=cid,
#                         name=f"Acct {acct[-8:]}",
#                         email=f"csv.{''.join(ch for ch in acct if ch.isalnum())[-8:].lower()}@imported.local",
#                         account_number=acct,
#                         risk_level=RiskLevel(risk.level),
#                         risk_score=risk.score,
#                         status=CustomerStatus.blocked if risk.level == "critical" else CustomerStatus.active,
#                         total_transactions=1,
#                         flagged_transactions=1 if risk.status != "cleared" else 0,
#                         country=country or "US",
#                     )
#                 )

#         tx = Transaction(
#             id=tx_id,
#             tx_hash=f"0x{uuid.uuid4().hex}",
#             from_account=from_account,
#             to_account=to_account,
#             from_customer_id=from_customer_id,
#             to_customer_id=to_customer_id,
#             amount=amount,
#             currency=currency,
#             status=TransactionStatus(risk.status),
#             risk_level=RiskLevel(risk.level),
#             risk_score=risk.score,
#             description=description or "CSV import",
#             country=country or "US",
#             channel=channel,
#         )
#         db.add(tx)
#         save_transfer_edge(tx.id, tx.from_account, tx.to_account, tx.amount, tx.status.value, tx.risk_level.value)

#         if risk.status != "cleared":
#             severity = (
#                 "critical"
#                 if risk.level == "critical"
#                 else "high"
#                 if risk.level == "high"
#                 else "medium"
#                 if risk.level == "medium"
#                 else "low"
#             )
#             title = (
#                 "Critical fraud risk - transaction blocked"
#                 if risk.score >= 80
#                 else "High-risk transaction flagged for review"
#                 if risk.score >= 60
#                 else "Large-value transfer detected"
#                 if amount > 50000
#                 else "Suspicious transaction - exceeds $1,000 threshold"
#             )
#             alert = Alert(
#                 id=f"ALT-{tx_id}",
#                 title=title,
#                 description=f"${amount:.2f} {currency} from {from_account} -> {to_account}. Score: {risk.score:.0f}/100. Flags: {'; '.join(risk.flags[:2])}",
#                 severity=AlertSeverity(severity),
#                 status=AlertStatus.open,
#                 transaction_id=tx_id,
#                 customer_id=from_customer_id,
#                 rule_triggered=risk.flags[0] if risk.flags else "CSV Risk Rule",
#             )
#             db.add(alert)
#             alerts.append(
#                 {
#                     "id": alert.id,
#                     "title": title,
#                     "severity": severity,
#                     "amount": amount,
#                     "currency": currency,
#                     "fromAccount": from_account,
#                     "toAccount": to_account,
#                     "riskScore": risk.score,
#                     "riskFlags": risk.flags,
#                     "transactionId": tx_id,
#                     "description": description,
#                 }
#             )

#         saved_tx = {**as_tx(tx), "riskFlags": risk.flags}
#         saved.append(saved_tx)

#         from_node = f"n-{from_customer_id}"
#         to_node = f"n-{to_customer_id}"
#         if from_node not in node_map:
#             node_map[from_node] = {
#                 "id": from_node,
#                 "label": from_account[:14],
#                 "type": "flagged" if risk.level == "critical" else "account",
#                 "riskLevel": risk.level,
#                 "totalAmount": amount,
#                 "txCount": 1,
#             }
#         else:
#             node_map[from_node]["totalAmount"] += amount
#             node_map[from_node]["txCount"] += 1
#         if to_node not in node_map:
#             node_map[to_node] = {
#                 "id": to_node,
#                 "label": to_account[:14],
#                 "type": "flagged" if risk.status == "blocked" else "merchant",
#                 "riskLevel": risk.level,
#                 "totalAmount": amount,
#                 "txCount": 1,
#             }
#         else:
#             node_map[to_node]["totalAmount"] += amount
#             node_map[to_node]["txCount"] += 1

#         edges.append(
#             {
#                 "id": f"e-{tx_id}",
#                 "source": from_node,
#                 "target": to_node,
#                 "amount": amount,
#                 "currency": currency,
#                 "timestamp": saved_tx["timestamp"],
#                 "status": "normal" if risk.status == "cleared" else "blocked" if risk.status == "blocked" else "flagged",
#                 "riskScore": risk.score,
#             }
#         )

#     db.commit()


# @router.post("/import-csv")
# def import_csv(
# payload: dict = Body(...),
# _user: User = Depends(get_current_user),
# db: Session = Depends(get_db),
# ):
# rows_in = payload.get("transactions", [])
#     if not isinstance(rows_in, list) or not rows_in:
# raise HTTPException(status_code=400, detail="No transactions provided")


# -----------------------------
# STEP 1: Normalize Data
# -----------------------------
    normalized = []
    for row in rows_in:
        amount = abs(float(row.get("amount") or 0))
        from_account = str(row.get("fromAccount") or "UNKNOWN").strip()
        to_account = str(row.get("toAccount") or "UNKNOWN").strip()

        if amount <= 0 or from_account == "UNKNOWN" or to_account == "UNKNOWN":
            continue

        normalized.append({
            "fromAccount": from_account,
            "toAccount": to_account,
            "amount": amount,
            "currency": str(row.get("currency") or "USD").upper()[:3],
            "description": str(row.get("description") or ""),
            "country": str(row.get("country") or "US"),
            "channel": str(row.get("channel") or "CSV Import"),
            "timestamp": str(row.get("timestamp") or ""),
        })

    if not normalized:
        raise HTTPException(status_code=400, detail="No valid transactions")

# -----------------------------
# STEP 2: ML + Frequency
# -----------------------------
    ml_boosts = isolation_forest_boosts(normalized)

    sender_freq = {}
    for r in normalized:
        sender_freq[r["fromAccount"]] = sender_freq.get(r["fromAccount"], 0) + 1

# -----------------------------
# STEP 3: PREPARE UNIQUE CUSTOMERS
# -----------------------------
    # all_customers = {}

    # -----------------------------
# STEP: STRICT UNIQUE CUSTOMERS
# -----------------------------
    customer_map = {}

    for row in normalized:
        for acct in [row["fromAccount"], row["toAccount"]]:
            cid = f"CUST-{''.join(ch for ch in acct if ch.isalnum())[:10].upper()}"

        # 🔥 ensures NO duplicates EVER
            if cid not in customer_map:
                customer_map[cid] = acct


# -----------------------------
# FETCH EXISTING
# -----------------------------
    existing_ids = set(
        x[0] for x in db.query(Customer.id)
        .filter(Customer.id.in_(list(customer_map.keys())))
        .all()
    )




    # for row in normalized:
    #     for acct in [row["fromAccount"], row["toAccount"]]:
    #         cid = f"CUST-{''.join(ch for ch in acct if ch.isalnum())[:10].upper()}"
    #         all_customers[cid] = acct

    # existing_ids = {
    #     c.id for c in db.query(Customer.id).filter(
    #         Customer.id.in_(list(all_customers.keys()))
    #     ).all()
    # }

    new_customers = []
    for cid, acct in customer_map.items():
        if cid in existing_ids:
            continue

        new_customers.append(
            Customer(
                id=cid,
                name=f"Acct {acct[-8:]}",
                email=f"csv.{''.join(ch for ch in acct if ch.isalnum())[-8:].lower()}@imported.local",
                account_number=acct,
                risk_level=RiskLevel.low,
                risk_score=0,
                status=CustomerStatus.active,
                total_transactions=0,
                flagged_transactions=0,
                country="US",
            )   
        )

    if new_customers:
        db.bulk_save_objects(new_customers)

# -----------------------------
# STEP 4: PROCESS TRANSACTIONS
# -----------------------------
    saved = []
    alerts = []
    node_map = {}
    edges = []

    for i, row in enumerate(normalized):
        amount = row["amount"]
        from_account = row["fromAccount"]
        to_account = row["toAccount"]

        from_customer_id = f"CUST-{''.join(ch for ch in from_account if ch.isalnum())[:10].upper()}"
        to_customer_id = f"CUST-{''.join(ch for ch in to_account if ch.isalnum())[:10].upper()}"

        ml_b = ml_boosts[i] if i < len(ml_boosts) else 0.0

        risk = compute_risk(
            amount=amount,
            currency=row["currency"],
            description=row["description"],
            country=row["country"],
            channel=row["channel"],
            timestamp=row["timestamp"],
            from_account=from_account,
            to_account=to_account,
            ml_boost=ml_b,
        )

    # frequency boost
        freq = sender_freq.get(from_account, 1)
        if freq >= 5:
            risk.score = min(99, risk.score + 12)
        elif freq >= 3:
            risk.score = min(99, risk.score + 6)

        risk.level = (
            "critical" if risk.score >= 80 else
            "high" if risk.score >= 60 else
            "medium" if risk.score >= 35 else
            "low"
        )

        risk.status = (
            "blocked" if risk.score >= 80 else
            "flagged" if risk.score >= 60 or amount > 1000 else
            "cleared"
        )

        tx_id = f"CSV-{uuid.uuid4().hex[:12].upper()}"

        tx = Transaction(
            id=tx_id,
            tx_hash=f"0x{uuid.uuid4().hex}",
            from_account=from_account,
            to_account=to_account,
            from_customer_id=from_customer_id,
            to_customer_id=to_customer_id,
            amount=amount,
            currency=row["currency"],
            status=TransactionStatus(risk.status),
            risk_level=RiskLevel(risk.level),
            risk_score=risk.score,
            description=row["description"],
            country=row["country"],
            channel=row["channel"],
        )

        db.add(tx)

    # -----------------------------
    # SAFE NEO4J CALL
    # -----------------------------
        try:
            save_transfer_edge(
                tx.id,
                tx.from_account,
                tx.to_account,
                tx.amount,
                tx.status.value,
                tx.risk_level.value,
            )
        except Exception as e:
            print("Neo4j skipped:", e)

    # -----------------------------
    # ALERT GENERATION
    # -----------------------------
        if risk.status != "cleared":
            alert = Alert(
                id=f"ALT-{tx_id}",
                title="Fraud Alert",
                description=f"{from_account} → {to_account} (${amount})",
                severity=AlertSeverity.high,
                status=AlertStatus.open,
                transaction_id=tx_id,
                customer_id=from_customer_id,
                rule_triggered="Risk Engine",
            )
            db.add(alert)
            alerts.append({"id": alert.id, "risk": risk.score})

        saved.append({**as_tx(tx), "riskScore": risk.score})

    db.commit()

# return {
#     "imported": len(saved),
#     "alerts": alerts,
#     "transactions": saved,
# }
# ```



    return {
        "imported": len(saved),
        "alerts": alerts,
        "graphData": {"nodes": list(node_map.values()), "edges": edges},
        "transactions": saved,
        "summary": {
            "total": len(saved),
            "blocked": len([t for t in saved if t["status"] == "blocked"]),
            "flagged": len([t for t in saved if t["status"] == "flagged"]),
            "cleared": len([t for t in saved if t["status"] == "cleared"]),
            "totalValue": sum(t["amount"] for t in saved),
            "avgRiskScore": (sum(t["riskScore"] for t in saved) / len(saved)) if saved else 0,
        },
    }




