from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import FraudCase, User
from app.utils.serializers import as_case

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("")
def list_cases(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(FraudCase).order_by(desc(FraudCase.created_at)).all()
    return [as_case(c) for c in rows]
