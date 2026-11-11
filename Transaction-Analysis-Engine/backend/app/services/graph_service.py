from app.database import neo4j as neo4j_db
from app.database.postgres import SessionLocal
from app.models.entities import Transaction


def save_transfer_edge(tx_id: str, from_account: str, to_account: str, amount: float, status: str, risk_level: str):
    neo4j_db.upsert_relationship(
        tx_id=tx_id,
        from_account=from_account,
        to_account=to_account,
        amount=amount,
        status=status,
        risk_level=risk_level,
    )


def get_cytoscape_graph(limit: int = 30):
    raw = neo4j_db.fetch_graph(limit=limit)
    nodes = []
    edges = []

    for n in raw.get("nodes", []):
        nodes.append(
            {
                "id": n["id"],
                "label": n["label"],
                "type": n["type"],
                "riskLevel": n["riskLevel"],
                "amount": n["amount"],
                "data": {
                    "id": n["id"],
                    "label": n["label"],
                    "type": n["type"],
                    "riskLevel": n["riskLevel"],
                    "amount": n["amount"],
                },
            }
        )
    for e in raw.get("edges", []):
        edges.append(
            {
                "id": e["id"],
                "source": e["source"],
                "target": e["target"],
                "amount": e["amount"],
                "status": e["status"],
                "data": {
                    "id": e["id"],
                    "source": e["source"],
                    "target": e["target"],
                    "amount": e["amount"],
                    "status": e["status"],
                },
            }
        )

    if not nodes and not edges:
        db = SessionLocal()
        try:
            txs = db.query(Transaction).order_by(Transaction.timestamp.desc()).limit(limit).all()
            node_map = {}
            for t in txs:
                src_id = f"acc-{''.join(ch for ch in t.from_account if ch.isalnum())}"
                tgt_id = f"acc-{''.join(ch for ch in t.to_account if ch.isalnum())}"
                rl = t.risk_level.value if hasattr(t.risk_level, "value") else str(t.risk_level)
                st = t.status.value if hasattr(t.status, "value") else str(t.status)
                if src_id not in node_map:
                    node_map[src_id] = {
                        "id": src_id,
                        "label": t.from_account[:12],
                        "type": "account",
                        "riskLevel": rl,
                        "amount": float(t.amount or 0),
                        "data": {
                            "id": src_id,
                            "label": t.from_account[:12],
                            "type": "account",
                            "riskLevel": rl,
                            "amount": float(t.amount or 0),
                        },
                    }
                if tgt_id not in node_map:
                    node_map[tgt_id] = {
                        "id": tgt_id,
                        "label": t.to_account[:12],
                        "type": "merchant",
                        "riskLevel": rl,
                        "amount": float(t.amount or 0),
                        "data": {
                            "id": tgt_id,
                            "label": t.to_account[:12],
                            "type": "merchant",
                            "riskLevel": rl,
                            "amount": float(t.amount or 0),
                        },
                    }
                edge_id = f"edge-{t.id}"
                edges.append(
                    {
                        "id": edge_id,
                        "source": src_id,
                        "target": tgt_id,
                        "amount": float(t.amount or 0),
                        "status": "normal" if st == "cleared" else ("blocked" if st == "blocked" else "flagged"),
                        "data": {
                            "id": edge_id,
                            "source": src_id,
                            "target": tgt_id,
                            "amount": float(t.amount or 0),
                            "status": "normal" if st == "cleared" else ("blocked" if st == "blocked" else "flagged"),
                        },
                    }
                )
            nodes = list(node_map.values())
        except Exception:
            pass
        finally:
            db.close()

    return {"nodes": nodes, "edges": edges}
