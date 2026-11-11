import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import User
from app.models.enums import UserRole


def ensure_demo_users(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    demo = [
        {
            "email": "tirumanimukesh@gmail.com",
            "name": "Mukesh Admin",
            "password": "Friends@",
            "role": UserRole.admin,
            "title": "Platform Administrator",
            "initials": "MA",
        },
        {
            "email": "analyst@aegis.com",
            "name": "Aegis Investigator",
            "password": "Analyst@123",
            "role": UserRole.investigator,
            "title": "Fraud Investigator",
            "initials": "AI",
        },
    ]
    for row in demo:
        db.add(
            User(
                id=f"USR-{uuid.uuid4().hex[:8].upper()}",
                email=row["email"],
                name=row["name"],
                password_hash=hash_password(row["password"]),
                role=row["role"],
                title=row["title"],
                initials=row["initials"],
            )
        )
    db.commit()
