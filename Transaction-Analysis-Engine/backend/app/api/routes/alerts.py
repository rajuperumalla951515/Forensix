from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.postgres import get_db
from app.models.entities import Alert, User
from app.models.enums import AlertSeverity, AlertStatus
from app.utils.serializers import as_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if severity and severity != "all":
        q = q.filter(Alert.severity == AlertSeverity(severity))
    if status and status != "all":
        q = q.filter(Alert.status == AlertStatus(status))
    rows = q.order_by(desc(Alert.timestamp)).all()
    return [as_alert(a) for a in rows]


@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: str,
    payload: dict = Body(...),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    new_status = payload.get("status")
    if new_status:
        alert.status = AlertStatus(new_status)
    db.commit()
    db.refresh(alert)
    return as_alert(alert)
