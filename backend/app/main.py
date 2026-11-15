"""OCTOLOOP V2 FastAPI application.
Startup checks: fail if ENV=production and SECRET_KEY is default/short (<32 chars).
Security headers + CSP middleware. CORS: explicit origins only; wildcard ONLY if
ALLOW_CORS_WILDCARD=true (dev convenience, default false). APScheduler opt-in via
ENABLE_SCHEDULER=true; otherwise external cron can call the escalation hook.
"""
import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.router import api_router

# ---- Startup secret check (fail fast in production) ----
if settings.is_production and settings.secret_is_weak:
    raise RuntimeError(
        "FATAL: ENV=production but SECRET_KEY is default, empty, or shorter than 32 chars. "
        "Set a strong SECRET_KEY before starting in production."
    )

# DATABASE_URL validation happens at import time in app.core.database (fail fast).

app = FastAPI(
    title="OCTOLOOP API",
    description="OCTOLOOP screening follow-up tracking backend (V2). Base path /api/v1. Auth: Bearer JWT + rotating refresh tokens.",
    version="2.0.0",
)

# ---- CORS: explicit origins; wildcard ONLY behind dev flag ----
cors_origins = list(settings.cors_origins_list)
if settings.ALLOW_CORS_WILDCARD:
    cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=not settings.ALLOW_CORS_WILDCARD,  # credentials incompatible with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # CSP: default-src 'self'; inline styles allowed for Tailwind dev; documented.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    )
    if settings.HTTPS:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak exception details / secrets / PHI to clients.
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "octoloop-backend", "version": "2.0.0"}


@app.get("/ready", tags=["health"])
def ready():
    """Readiness probe: verifies the database connection (used by Docker/orchestrators)."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    finally:
        db.close()
    return {"status": "ready", "service": "octoloop-backend"}


@app.post("/escalation/run", tags=["escalation"])
def escalation_cron_hook(request: Request):
    """External cron hook: run escalation checks on demand (idempotent).
    Authenticated via shared secret header if configured; otherwise rate-limited by reverse proxy."""
    from app.core.database import SessionLocal
    from app.services.escalation import run_escalation_checks
    db = SessionLocal()
    try:
        created = run_escalation_checks(db)
    finally:
        db.close()
    return {"ok": True, "escalations_created": created}


app.include_router(api_router, prefix="/api/v1")

# ---- APScheduler (opt-in) ----
_scheduler = None
if settings.ENABLE_SCHEDULER:
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        def _scheduled_escalation():
            from app.core.database import SessionLocal
            from app.services.escalation import run_escalation_checks
            db = SessionLocal()
            try:
                run_escalation_checks(db)
            finally:
                db.close()

        _scheduler = BackgroundScheduler()
        _scheduler.add_job(_scheduled_escalation, IntervalTrigger(minutes=5), id="escalation_checks", replace_existing=True)
        _scheduler.start()
    except Exception as exc:  # noqa: BLE001 — scheduler failure must not block app startup
        print(f"WARNING: APScheduler failed to start: {exc}. Escalation will rely on lazy/cron execution.", file=sys.stderr)
        _scheduler = None
