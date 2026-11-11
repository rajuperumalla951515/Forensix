from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.cases import router as cases_router
from app.api.routes.customers import router as customers_router
from app.api.routes.fund_flow import router as fund_flow_router
from app.api.routes.reports import router as reports_router

__all__ = [
    "health_router",
    "auth_router",
    "dashboard_router",
    "transactions_router",
    "alerts_router",
    "cases_router",
    "customers_router",
    "fund_flow_router",
    "reports_router",
]
