from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_perm
from app.models.user import User
from app.models.case import FollowUpCase
from app.schemas import (
    AISummarizeRequest, AISummarizeResponse, AIOperationalInsights,
    AIQueryRequest, AIQueryResponse,
)
from app.services import ai_ops

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summarize-case", response_model=AISummarizeResponse)
def summarize_case(payload: AISummarizeRequest,
                   current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    case = db.query(FollowUpCase).filter(FollowUpCase.id == payload.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    result = ai_ops.summarize_case(db, payload.case_id)
    return AISummarizeResponse(**result)


@router.get("/operational-insights", response_model=AIOperationalInsights)
def operational_insights(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    result = ai_ops.operational_insights(db)
    return AIOperationalInsights(**result)


@router.post("/query-dashboard", response_model=AIQueryResponse)
def query_dashboard(payload: AIQueryRequest,
                    current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    """V2: natural-language operational query. Deterministic keyword routing (mandatory fallback);
    optional LLM refinement with PHI-minimization + 10s timeout. ALWAYS includes disclaimer.
    Never diagnoses/prescribes/closes/fabricates PHI."""
    result = ai_ops.query_dashboard(db, payload.question)
    return AIQueryResponse(**result)
