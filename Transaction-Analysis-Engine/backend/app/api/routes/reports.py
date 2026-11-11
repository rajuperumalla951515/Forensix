from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import Transaction, User
from app.models.enums import TransactionStatus

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary")
def reports_summary(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    month_expr = (
        func.strftime("%Y-%m", Transaction.timestamp)
        if db.bind.dialect.name == "sqlite"
        else func.to_char(Transaction.timestamp, "Mon YYYY")
    )
    monthly = (
        db.query(
            month_expr.label("month"),
            Transaction.status,
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("amount"),
        )
        .group_by(month_expr, Transaction.status)
        .all()
    )
    month_map = {}
    for m in monthly:
        key = m.month
        if key not in month_map:
            month_map[key] = {"month": key, "flagged": 0, "cleared": 0, "amount": 0}
        if m.status == TransactionStatus.flagged:
            month_map[key]["flagged"] += int(m.count)
        if m.status == TransactionStatus.cleared:
            month_map[key]["cleared"] += int(m.count)
        month_map[key]["amount"] += float(m.amount or 0)

    country_raw = (
        db.query(Transaction.country, func.count(Transaction.id), func.coalesce(func.sum(Transaction.amount), 0))
        .group_by(Transaction.country)
        .order_by(desc(func.count(Transaction.id)))
        .limit(10)
        .all()
    )
    channel_raw = db.query(Transaction.channel, func.count(Transaction.id)).group_by(Transaction.channel).all()
    total_tx = sum(int(c[1]) for c in channel_raw)

    return {
        "monthlyFraudTrend": list(month_map.values()),
        "fraudByCategory": [
            {
                "category": ch,
                "count": int(cnt),
                "percentage": round((int(cnt) / total_tx) * 100, 1) if total_tx else 0,
            }
            for ch, cnt in channel_raw
        ],
        "topRiskyCountries": [{"country": c, "count": int(cnt), "amount": float(amt or 0)} for c, cnt, amt in country_raw],
    }
