from __future__ import annotations

from io import StringIO
from typing import Any
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="AURUMIQ API",
    description="Gold contract normalization and relative-pricing prototype. Sample data is synthetic.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUIRED = [
    "date", "symbol", "expiry", "settlement_price", "volume", "open_interest",
    "quote_unit_grams", "purity_per_mille", "transaction_cost_bps"
]
NUMERIC = [
    "settlement_price", "volume", "open_interest", "quote_unit_grams",
    "purity_per_mille", "transaction_cost_bps"
]

class AnalysisOptions(BaseModel):
    reference_purity_per_mille: float = Field(default=999, gt=0, le=1000)
    min_volume: float = Field(default=1, ge=0)
    min_open_interest: float = Field(default=1, ge=0)
    deviation_threshold_pct: float = Field(default=0.75, gt=0, le=100)
    train_fraction: float = Field(default=0.7, gt=0.2, lt=0.95)

def clean_frame(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError("Missing required columns: " + ", ".join(missing))
    df = df[REQUIRED].copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["symbol"] = df["symbol"].astype(str).str.strip().str.upper()
    df["expiry"] = df["expiry"].astype(str).str.strip()
    df = df.dropna(subset=["date"] + NUMERIC)
    df = df[
        (df["symbol"] != "") &
        (df["settlement_price"] > 0) &
        (df["volume"] >= 0) &
        (df["open_interest"] >= 0) &
        (df["quote_unit_grams"] > 0) &
        (df["purity_per_mille"] > 0) &
        (df["purity_per_mille"] <= 1000) &
        (df["transaction_cost_bps"] >= 0)
    ]
    if df.empty:
        raise ValueError("No valid rows remain after validation.")
    return df.sort_values(["date", "symbol"]).reset_index(drop=True)

def analyze(df: pd.DataFrame, options: AnalysisOptions) -> dict[str, Any]:
    df = clean_frame(df)
    df["normalized_price_per_gram"] = (
        df["settlement_price"] / df["quote_unit_grams"]
        * (options.reference_purity_per_mille / df["purity_per_mille"])
    )

    # Compare only rows on the same date. This is a screening metric, not an arbitrage claim.
    df["daily_reference_price"] = df.groupby("date")["normalized_price_per_gram"].transform("median")
    df["deviation_pct"] = (
        (df["normalized_price_per_gram"] / df["daily_reference_price"]) - 1
    ) * 100
    df["unusual_deviation"] = df["deviation_pct"].abs() >= options.deviation_threshold_pct
    df["passes_liquidity"] = (
        (df["volume"] >= options.min_volume) &
        (df["open_interest"] >= options.min_open_interest)
    )
    # A transparent estimate of round-trip cost as a percent of normalized price.
    df["estimated_cost_pct"] = df["transaction_cost_bps"] / 100
    df["deviation_after_cost_pct"] = df["deviation_pct"].abs() - df["estimated_cost_pct"]
    df["passes_cost_screen"] = df["deviation_after_cost_pct"] > 0
    df["screened_candidate"] = (
        df["unusual_deviation"] & df["passes_liquidity"] & df["passes_cost_screen"]
    )

    dates = sorted(df["date"].dt.strftime("%Y-%m-%d").unique().tolist())
    split_index = max(1, min(len(dates) - 1, int(len(dates) * options.train_fraction))) if len(dates) > 1 else len(dates)
    train_dates = set(dates[:split_index])
    test_dates = set(dates[split_index:])
    df["period"] = np.where(df["date"].dt.strftime("%Y-%m-%d").isin(train_dates), "Train", "Holdout")
    if len(dates) < 2:
        holdout_note = "At least two distinct dates are needed for a chronological holdout; all rows are shown as training data."
    else:
        holdout_note = "Chronological split only. This is not a profitability backtest and does not establish a tradable strategy."

    rows = df.copy()
    rows["date"] = rows["date"].dt.strftime("%Y-%m-%d")
    rows = rows.replace({np.nan: None})
    row_records = rows.to_dict(orient="records")

    latest_date = max(dates)
    latest = df[df["date"].dt.strftime("%Y-%m-%d") == latest_date]
    summary = {
        "rows_analyzed": int(len(df)),
        "contracts": sorted(df["symbol"].unique().tolist()),
        "date_start": min(dates),
        "date_end": max(dates),
        "latest_date": latest_date,
        "latest_median_normalized_price": round(float(latest["normalized_price_per_gram"].median()), 4),
        "latest_deviations": int(latest["unusual_deviation"].sum()),
        "latest_screened_candidates": int(latest["screened_candidate"].sum()),
        "holdout_rows": int((df["period"] == "Holdout").sum()),
        "holdout_candidates": int(((df["period"] == "Holdout") & df["screened_candidate"]).sum()),
        "reference_purity_per_mille": options.reference_purity_per_mille,
        "holdout_note": holdout_note,
        "data_notice": "Results depend on uploaded data and configurable assumptions. They are analytics screens, not trading advice."
    }

    chart = []
    for date, group in df.groupby("date"):
        chart.append({
            "date": date.strftime("%Y-%m-%d"),
            **{str(row["symbol"]): round(float(row["normalized_price_per_gram"]), 4)
               for _, row in group.iterrows()}
        })

    return {"summary": summary, "rows": row_records, "chart": chart}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AURUMIQ API", "version": "0.1.0"}

@app.post("/api/analyze")
async def analyze_upload(
    file: UploadFile = File(...),
    reference_purity_per_mille: float = 999,
    min_volume: float = 1,
    min_open_interest: float = 1,
    deviation_threshold_pct: float = 0.75,
    train_fraction: float = 0.7,
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")
    try:
        raw = await file.read()
        df = pd.read_csv(StringIO(raw.decode("utf-8-sig")))
        options = AnalysisOptions(
            reference_purity_per_mille=reference_purity_per_mille,
            min_volume=min_volume,
            min_open_interest=min_open_interest,
            deviation_threshold_pct=deviation_threshold_pct,
            train_fraction=train_fraction,
        )
        return analyze(df, options)
    except (UnicodeDecodeError, pd.errors.ParserError) as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
