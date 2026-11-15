#!/usr/bin/env python3
"""Seed demo data only (tables must already exist). Run from project root."""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.database import SessionLocal  # noqa: E402
from app.services.seed import seed_demo_data  # noqa: E402


def main():
    db = SessionLocal()
    try:
        result = seed_demo_data(db)
    finally:
        db.close()
    if result.get("skipped"):
        print("Seed skipped: already seeded.")
    else:
        print("Seed complete:", result)


if __name__ == "__main__":
    main()
