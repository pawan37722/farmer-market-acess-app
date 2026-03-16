# ai-service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List

app = FastAPI(
    title="AgriTrust Rating Engine",
    description="Calculates weighted trust scores for AgriApp farmers and buyers",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ───────────────────────────────────────────
class ReviewEntry(BaseModel):
    rating: float = Field(..., ge=1, le=5, description="Star rating 1–5")
    completed: bool = Field(..., description="Was the transaction completed?")


class TrustRequest(BaseModel):
    user_id: str
    reviews: List[ReviewEntry]


class TrustResponse(BaseModel):
    user_id: str
    trust_score: float       # 0.00 – 5.00
    completion_rate: float   # 0.00 – 1.00
    avg_feedback: float      # 1.00 – 5.00
    review_count: int
    badge: str               # New / Bronze / Silver / Gold / Platinum


# ── Badge assignment ──────────────────────────────────────────
def assign_badge(score: float, count: int) -> str:
    if count < 3:
        return "New"
    if score >= 4.5:
        return "Platinum"
    if score >= 4.0:
        return "Gold"
    if score >= 3.0:
        return "Silver"
    return "Bronze"


# ── POST /calculate-trust ─────────────────────────────────────
@app.post("/calculate-trust", response_model=TrustResponse)
def calculate_trust(data: TrustRequest):
    if not data.reviews:
        raise HTTPException(status_code=400, detail="No review data provided")

    total           = len(data.reviews)
    completed_count = sum(1 for r in data.reviews if r.completed)
    completion_rate = completed_count / total
    avg_feedback    = sum(r.rating for r in data.reviews) / total

    # Normalise 1–5 star average to 0–1 range
    norm_feedback = (avg_feedback - 1) / 4

    # Weighted formula:
    # trust_score = (0.7 × normalised_feedback + 0.3 × completion_rate) × 5
    trust_score = round((0.7 * norm_feedback + 0.3 * completion_rate) * 5, 2)

    # Recency bonus: last 10 reviews carry extra 10% weight
    if total >= 10:
        recent      = data.reviews[-10:]
        recent_avg  = sum(r.rating for r in recent) / len(recent)
        recency_adj = ((recent_avg - avg_feedback) / 4) * 0.1
        trust_score = min(5.0, round(trust_score + recency_adj, 2))

    return TrustResponse(
        user_id         = data.user_id,
        trust_score     = trust_score,
        completion_rate = round(completion_rate, 2),
        avg_feedback    = round(avg_feedback, 2),
        review_count    = total,
        badge           = assign_badge(trust_score, total),
    )


# ── GET /health ───────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "AgriTrust AI"}


# ── GET / ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service":   "AgriTrust Rating Engine",
        "version":   "1.0.0",
        "endpoints": ["/calculate-trust", "/health", "/docs"],
    }
