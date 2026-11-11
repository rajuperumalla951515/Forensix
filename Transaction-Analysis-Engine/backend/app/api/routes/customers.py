from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import Customer, User
from app.models.enums import RiskLevel
from app.utils.serializers import as_customer

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(
    search: str | None = Query(default=None),
    riskLevel: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Customer)
    if riskLevel and riskLevel != "all":
        q = q.filter(Customer.risk_level == RiskLevel(riskLevel))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Customer.name.ilike(like)) | (Customer.email.ilike(like)) | (Customer.account_number.ilike(like))
        )
    rows = q.order_by(desc(Customer.risk_score)).all()
    return [as_customer(c) for c in rows]
