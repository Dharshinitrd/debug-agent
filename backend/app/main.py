from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.analyzer import analyze, SUPPORTED_LANGUAGES, DebugResult

app = FastAPI(title="Debugging Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your frontend origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    code: str
    language: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/languages")
def languages():
    return {"supported": sorted(SUPPORTED_LANGUAGES)}


@app.post("/analyze", response_model=DebugResult)
def analyze_code(req: AnalyzeRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="code must not be empty")
    if req.language.lower() not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"language must be one of {sorted(SUPPORTED_LANGUAGES)}",
        )
    try:
        return analyze(req.code, req.language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
