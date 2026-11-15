#!/usr/bin/env python3
"""Create all tables and seed demo data. Run from project root: python scripts/init_db.py"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.database import Base, engine, SessionLocal  # noqa: E402
import app.models  # noqa: E402,F401  (populate metadata)
from app.services.seed import seed_demo_data  # noqa: E402


def main():
    print(f"Using database: {engine.url}")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")
    db = SessionLocal()
    try:
        result = seed_demo_data(db)
    finally:
        db.close()
    if result.get("skipped"):
        print("Seed skipped: database already seeded (admin user exists).")
    else:
        print("Seed complete. Row counts:")
        for k, v in result.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
