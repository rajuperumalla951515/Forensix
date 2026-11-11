# Fraud Detection Hub

Production-oriented local stack: **FastAPI** (PostgreSQL + Neo4j), **React** dashboard, **JWT** auth with **admin** and **investigator** roles, rule-based + **Isolation Forest** risk scoring, and a **Cytoscape-compatible** fund-flow graph API.

## Prerequisites

- Python **3.11+** (3.12 recommended; some3.14 builds may need extra wheels for scientific packages)
- Node.js **20+**
- **PostgreSQL** on `localhost:5432`
- **Neo4j** on `bolt://localhost:7687`

Create database `fraud_db` (or set `DATABASE_URL` accordingly).

## Environment variables

**Backend** (e.g. `backend/.env` or shell):

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://postgres:password@localhost:5432/fraud_db` |
| `NEO4J_URI` | Bolt URI | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j user | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `password` |
| `JWT_SECRET` | HS256 signing secret (long random in prod) | `change-me-in-production-use-long-random-string` |
| `CORS_ORIGIN` | Allowed UI origin | `http://localhost:5173` |

**Frontend** — `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

All REST paths below are relative to that base (e.g. full URL `http://localhost:8000/api/dashboard/kpis`).

## Run commands

From repo root:

```powershell
# Backend dependencies
py -m pip install -r backend/requirements.txt

# API (reload)
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```powershell
# Frontend
cd frontend
npm install
npm run dev
```

```powershell
# Backend
cd backend
Remove-Item -Recurse -Force .venv
py -3.11 -m venv .venv
.\.venv\Scripts\activate
python --version
O/P: Python 3.11.x
pip install -r requirements.txt
python -m uvicorn app.main:app
```

```powershell
#setup bcrypt
pip uninstall bcrypt -y
pip install bcrypt==4.0.1
pip install passlib[bcrypt]==1.7.4 --force-reinstall
pip show bcrypt
Version: 4.0.1
pip uninstall bcrypt passlib -y
pip install passlib==1.7.4 bcrypt==4.0.1
pip show bcrypt
Version: 4.0.1
python -m uvicorn app.main:app --reload

Optional demo data (PostgreSQL + Neo4j graph edges):

```powershell
cd backend
py -m scripts.seed_data
```

On first API startup, **demo users** are created if the `users` table is empty:

- Admin: `tirumanimukesh@gmail.com` / `Friends@`
- Investigator: `analyst@aegis.com` / `Analyst@123`

## Architecture

- `backend/app/main.py` — FastAPI app, CORS, lifespan (DB tables + demo users).
- `backend/app/core/` — `config`, `security` (JWT, passwords), `bootstrap` (seed users).
- `backend/app/database/postgres.py` — SQLAlchemy engine/session.
- `backend/app/database/neo4j.py` — Neo4j driver, `Account`/`TRANSFER` graph IO.
- `backend/app/api/routes/` — HTTP routers (prefix `/api/...`).
- `backend/app/models/` — SQLAlchemy entities (`customers`, `transactions`, `alerts`, `cases`, `users`).
- `backend/app/services/` — `fraud_service` (rules + Isolation Forest batch scoring), `graph_service` (Cytoscape JSON).

## API (must match dashboard)

Protected routes require header: `Authorization: Bearer <token>` (login/signup only are public among business APIs).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/kpis` | KPI metrics |
| GET | `/api/dashboard/recent-alerts` | Recent alerts |
| GET | `/api/transactions` | Paginated list (`page`, `limit`, `status`, `riskLevel`, `search`) |
| GET | `/api/transactions/{id}` | Single transaction |
| POST | `/api/transactions/import-csv` | Body `{ "transactions": [...] }` — rules + IF scoring, PG + Neo4j |
| GET | `/api/alerts` | Alerts (`severity`, `status` filters) |
| PATCH | `/api/alerts/{id}/status` | Body `{ "status": "open" \| "investigating" \| "resolved" \| "dismissed" }` |
| GET | `/api/cases` | Cases |
| GET | `/api/customers` | Customers (`search`, `riskLevel`) |
| GET | `/api/fund-flow/graph` | Cytoscape-style `{ nodes, edges }` from Neo4j |
| GET | `/api/reports/summary` | Reports aggregates |
| POST | `/api/auth/signup` | Register (`role`: `admin` \| `investigator`; legacy `analyst` mapped to investigator) |
| POST | `/api/auth/login` | JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/users` | List users (admin) |
| DELETE | `/api/auth/users/{id}` | Delete user (admin) |
| GET | `/healthz` | Liveness |

Interactive docs: `http://localhost:8000/docs` (Swagger).

## Postman

1. `POST /api/auth/login` with JSON `{ "email", "password" }` → copy `token`.
2. Set collection/environment variable `token` and header `Authorization: Bearer {{token}}`.
3. Call any `GET /api/...` above.

## Fraud detection

- **Rule-based** signals: amount bands, round amounts, country/channel risk, off-hours, self-transfer, keywords, FX.
- **Isolation Forest** (scikit-learn): batch anomaly score on CSV import; blended into risk score with explicit flag.
- **Risk score** drives `risk_level` and `status` (`cleared` / `flagged` / `blocked`).


