import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_current_user, hash_password, require_admin, verify_password
from app.database.postgres import get_db
from app.models.entities import User
from app.models.enums import UserRole
from app.utils.serializers import as_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public(u: User) -> dict:
    return as_user(u)


@router.post("/signup")
def signup(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip()
    password = payload.get("password")
    name = (payload.get("name") or "").strip()
    role_raw = payload.get("role", "investigator")
    if role_raw == "analyst":
        role_raw = "investigator"
    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="email, password and name are required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    role = UserRole.admin if role_raw == "admin" else UserRole.investigator
    if db.query(User).filter(User.email.ilike(email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    initials = "".join(part[0] for part in name.split()[:2]).upper() or "U"
    title = "Platform Administrator" if role == UserRole.admin else "Fraud Investigator"
    user = User(
        id=f"USR-{uuid.uuid4().hex[:10].upper()}",
        email=email,
        name=name,
        password_hash=hash_password(password),
        role=role,
        title=title,
        initials=initials,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user), "user": _public(user)}


@router.post("/login")
def login(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip()
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user), "user": _public(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _public(user)


@router.get("/users")
def list_users(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(User).order_by(User.created_at).all()
    return [_public(u) for u in rows]


@router.delete("/users/{user_id}")
def delete_user_route(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"success": True}
