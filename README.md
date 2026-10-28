# AURUMIQ — Gold Contract Intelligence

AURUMIQ is a prototype analytics dashboard designed to compare gold futures contracts on a normalized basis and identify relative pricing deviations.

## Features
- Gold contract price normalization
- Relative pricing and deviation screening
- Configurable reference purity and deviation threshold
- Cost and liquidity filters
- Chronological validation split
- CSV upload and analysis dashboard

## Technology Stack
- **Frontend:** React, Vite, CSS
- **Backend:** Python, FastAPI, Pandas, NumPy
- **Data:** CSV input

## Project Structure
- `backend/` — API and analysis logic
- `frontend/` — Dashboard interface
- `data/` — Sample CSV dataset

## Run Locally

### Backend
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## Sample Data
The bundled sample dataset contains **synthetic demonstration data**, not verified live market prices. Upload verified market data and confirm contract specifications before drawing real-market conclusions.

## Disclaimer
AURUMIQ is an analytical prototype for demonstration and research. It is not financial or trading advice.
