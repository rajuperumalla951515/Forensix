import logging
from typing import Any

try:
    from neo4j import GraphDatabase
except ImportError:
    GraphDatabase = None

from app.core.config import settings

logger = logging.getLogger(__name__)
_driver = None


def get_driver():
    global _driver
    if GraphDatabase is None:
        return None
    if _driver is None:
        try:
            _driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
        except Exception as exc:
            logger.warning("Neo4j driver connection failed: %s", exc)
            return None
    return _driver


def close_driver():
    global _driver
    if _driver is not None:
        try:
            _driver.close()
        except Exception:
            pass
        _driver = None


def upsert_relationship(
    tx_id: str,
    from_account: str,
    to_account: str,
    amount: float,
    status: str,
    risk_level: str,
) -> None:
    query = """
    MERGE (a:Account {id: $from_account})
    MERGE (b:Account {id: $to_account})
    MERGE (a)-[r:TRANSFER {tx_id: $tx_id}]->(b)
    SET r.amount = $amount, r.status = $status, r.risk_level = $risk_level
    """
    try:
        drv = get_driver()
        if drv is None:
            return
        with drv.session() as session:
            session.run(
                query,
                tx_id=tx_id,
                from_account=from_account,
                to_account=to_account,
                amount=amount,
                status=status,
                risk_level=risk_level,
            )
    except Exception as exc:
        logger.warning("Neo4j upsert failed (graph may be unavailable): %s", exc)


def fetch_graph(limit: int = 30) -> dict[str, Any]:
    query = """
    MATCH (a:Account)-[r:TRANSFER]->(b:Account)
    RETURN a.id AS source, b.id AS target, r.tx_id AS tx_id,
           r.amount AS amount, r.status AS status, r.risk_level AS risk_level
    ORDER BY r.tx_id DESC
    LIMIT $limit
    """
    try:
        drv = get_driver()
        if drv is None:
            return {"nodes": [], "edges": []}
        with drv.session() as session:
            records = list(session.run(query, limit=limit))
    except Exception as exc:
        logger.warning("Neo4j query failed: %s", exc)
        return {"nodes": [], "edges": []}

    node_map: dict[str, dict] = {}
    edges: list[dict] = []
    for r in records:
        source = r["source"]
        target = r["target"]
        source_id = f"acc-{''.join(ch for ch in source if ch.isalnum())}"
        target_id = f"acc-{''.join(ch for ch in target if ch.isalnum())}"
        rl = r["risk_level"] or "low"
        if source_id not in node_map:
            node_map[source_id] = {
                "id": source_id,
                "label": source[:12],
                "type": "account",
                "riskLevel": rl,
                "amount": float(r["amount"] or 0),
            }
        if target_id not in node_map:
            node_map[target_id] = {
                "id": target_id,
                "label": target[:12],
                "type": "merchant",
                "riskLevel": rl,
                "amount": float(r["amount"] or 0),
            }
        st = r["status"] or "pending"
        edges.append(
            {
                "id": f"edge-{r['tx_id']}",
                "source": source_id,
                "target": target_id,
                "amount": float(r["amount"] or 0),
                "status": "normal"
                if st == "cleared"
                else ("blocked" if st == "blocked" else "flagged"),
            }
        )
    return {"nodes": list(node_map.values()), "edges": edges}
