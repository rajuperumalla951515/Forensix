from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.models.entities import User
from app.services.graph_service import get_cytoscape_graph

router = APIRouter(prefix="/api/fund-flow", tags=["fund-flow"])


@router.get("/graph")
def fund_flow_graph(
    transactionId: str | None = Query(default=None),
    customerId: str | None = Query(default=None),
    _user: User = Depends(get_current_user),
):
    _ = transactionId
    _ = customerId
    return get_cytoscape_graph(limit=80)
