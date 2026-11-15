from fastapi import APIRouter
from app.api import (
    auth, dashboard, patients, screenings, cases, referrals, appointments,
    notifications, analytics, ai, admin, population, portal,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(patients.router)
api_router.include_router(screenings.router)
api_router.include_router(cases.router)
api_router.include_router(referrals.router)
api_router.include_router(appointments.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(ai.router)
api_router.include_router(admin.router)
api_router.include_router(population.router)
api_router.include_router(portal.router)
