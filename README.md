# Forensix

Forensic Transaction Analysis & Fraud Detection Engine.

Forensix is a financial forensics platform designed for fraud detection and financial network analysis:
- **Backend**: FastAPI with SQLite / PostgreSQL support, rule-based fraud scoring, and scikit-learn Isolation Forest anomaly detection.
- **Interactive Graph Analytics**: Cytoscape-compatible fund-flow network visualization.
- **Frontend**: React + Vite + Tailwind CSS dashboard with KPIs, real-time alerts, case investigation workflows, and customer profiles.

## Project Structure

- [`Transaction-Analysis-Engine/`](./Transaction-Analysis-Engine)
  - [`backend/`](./Transaction-Analysis-Engine/backend): FastAPI REST API and data ingestion services
  - [`frontend/`](./Transaction-Analysis-Engine/frontend): React investigation dashboard

## Quick Start

### 1. Backend

```powershell
cd Transaction-Analysis-Engine/backend
py -m pip install -r requirements.txt
py -m scripts.seed_data
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```powershell
cd Transaction-Analysis-Engine/frontend
npm install
npm run dev
```

Dashboard runs on `http://localhost:5173` and connects to API on `http://localhost:8000`.
