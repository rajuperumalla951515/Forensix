from fastapi import APIRouter, Depends
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import Alert, FraudCase, Transaction, User
from app.models.enums import AlertStatus, CaseStatus, TransactionStatus
from app.utils.serializers import as_alert

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/kpis")
def dashboard_kpis(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.query(func.count(Transaction.id)).scalar() or 0
    flagged = (
        db.query(func.count(Transaction.id)).filter(Transaction.status == TransactionStatus.flagged).scalar() or 0
    )
    open_alerts = db.query(func.count(Alert.id)).filter(Alert.status == AlertStatus.open).scalar() or 0
    active_cases = (
        db.query(func.count(FraudCase.id))
        .filter(FraudCase.status.in_([CaseStatus.open, CaseStatus.investigating]))
        .scalar()
        or 0
    )
    amount_flagged = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.status == TransactionStatus.flagged)
        .scalar()
        or 0
    )
    fraud_rate = round((flagged / total) * 100, 2) if total > 0 else 0
    return {
        "totalTransactions": total,
        "totalTransactionsDelta": 12.4,
        "flaggedTransactions": flagged,
        "flaggedTransactionsDelta": -3.2,
        "openAlerts": open_alerts,
        "openAlertsDelta": 5.1,
        "activeCases": active_cases,
        "activeCasesDelta": -1.0,
        "fraudRate": fraud_rate,
        "fraudRateDelta": -0.8,
        "totalAmountFlagged": float(amount_flagged),
        "totalAmountFlaggedDelta": 8.3,
    }


@router.get("/recent-alerts")
def dashboard_recent_alerts(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(desc(Alert.timestamp)).limit(6).all()
    return [as_alert(a) for a in alerts]
