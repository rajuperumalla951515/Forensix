from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    alerts_router,
    auth_router,
    cases_router,
    customers_router,
    dashboard_router,
    fund_flow_router,
    health_router,
    reports_router,
    transactions_router,
)
from app.core.bootstrap import ensure_demo_users
from app.core.config import settings
from app.database import neo4j as neo4j_db
from app.database.postgres import Base, SessionLocal, engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_demo_users(db)
    finally:
        db.close()
    yield
    neo4j_db.close_driver()


app = FastAPI(title="Fraud Detection Hub API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin, "http://127.0.0.1:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(transactions_router)
app.include_router(alerts_router)
app.include_router(cases_router)
app.include_router(customers_router)
app.include_router(fund_flow_router)
app.include_router(reports_router)
