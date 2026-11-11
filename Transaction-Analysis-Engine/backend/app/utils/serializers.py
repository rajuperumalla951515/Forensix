from datetime import datetime, timezone
from app.models.entities import Customer, Transaction, Alert, FraudCase, User


def now_iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else datetime.now(timezone.utc).isoformat()


def as_customer(c: Customer):
    return {
        "id": c.id,
        "name": c.name,
        "email": c.email,
        "accountNumber": c.account_number,
        "riskLevel": c.risk_level.value,
        "riskScore": c.risk_score,
        "status": c.status.value,
        "totalTransactions": c.total_transactions,
        "flaggedTransactions": c.flagged_transactions,
        "country": c.country,
        "joinedAt": now_iso(c.joined_at),
    }


def as_tx(t: Transaction):
    return {
        "id": t.id,
        "txHash": t.tx_hash,
        "fromAccount": t.from_account,
        "toAccount": t.to_account,
        "fromCustomerId": t.from_customer_id,
        "toCustomerId": t.to_customer_id,
        "amount": t.amount,
        "currency": t.currency,
        "status": t.status.value,
        "riskLevel": t.risk_level.value,
        "riskScore": t.risk_score,
        "description": t.description,
        "timestamp": now_iso(t.timestamp),
        "country": t.country,
        "channel": t.channel,
    }


def as_alert(a: Alert):
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "severity": a.severity.value,
        "status": a.status.value,
        "transactionId": a.transaction_id,
        "customerId": a.customer_id,
        "timestamp": now_iso(a.timestamp),
        "ruleTriggered": a.rule_triggered,
    }


def as_user(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role.value,
        "title": u.title,
        "initials": u.initials,
        "createdAt": now_iso(u.created_at),
        "lastLogin": now_iso(u.last_login) if u.last_login else None,
    }


def as_case(c: FraudCase):
    return {
        "id": c.id,
        "caseNumber": c.case_number,
        "title": c.title,
        "status": c.status.value,
        "priority": c.priority.value,
        "assignee": c.assignee,
        "customerId": c.customer_id,
        "customerName": c.customer_name,
        "totalAmount": c.total_amount,
        "transactionCount": c.transaction_count,
        "createdAt": now_iso(c.created_at),
        "updatedAt": now_iso(c.updated_at),
    }
