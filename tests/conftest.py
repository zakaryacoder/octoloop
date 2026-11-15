import sys
from datetime import date
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.user import User, Role, Permission  # noqa: E402
from app.models.patient import Patient  # noqa: E402
import app.models  # noqa: E402,F401
from app.main import app  # noqa: E402
from app.services.seed import ensure_v2_permissions_and_roles, ROLE_PERMISSIONS  # noqa: E402

TEST_USERS = [
    ("admin", "Admin@12345", "admin", "System Administrator"),
    ("dr.smith", "Clinician@123", "clinician", "Dr. Alice Smith"),
    ("nurse.jones", "Nurse@12345", "nurse", "Nurse Bob Jones"),
    ("coordinator.lee", "Coord@12345", "coordinator", "Carol Lee"),
    ("viewer.demo", "Viewer@12345", "viewer", "Demo Viewer"),
]


def seed_test_data(session):
    # V2: seed real permission strings + role grants (per V2_CONTRACT §2 matrix).
    ensure_v2_permissions_and_roles(session)
    role_objs = {r.name: r for r in session.query(Role).all()}

    for username, password, role, full_name in TEST_USERS:
        u = User(
            username=username, hashed_password=get_password_hash(password),
            full_name=full_name, email=f"{username}@test.local", role=role, is_active=True,
        )
        u.roles = [role_objs[role]]
        session.add(u)
    session.flush()

    # Two patients for portal isolation tests (patient A / patient B).
    p_a = Patient(mrn="MRN-PAT-A", first_name="Alice", last_name="PatientA",
                  date_of_birth=date(1990, 1, 1), phone="+1-555-0001", email="a@portal.test",
                  address="1 Downtown District")
    p_b = Patient(mrn="MRN-PAT-B", first_name="Bob", last_name="PatientB",
                  date_of_birth=date(1985, 5, 5), phone="+1-555-0002", email="b@portal.test",
                  address="2 Northside District")
    session.add_all([p_a, p_b])
    session.flush()

    # Patient portal users linked to each patient.
    for uname, pwd, pid in [("patient.a", "PatientA@123", p_a.id), ("patient.b", "PatientB@123", p_b.id)]:
        u = User(username=uname, hashed_password=get_password_hash(pwd),
                 full_name=uname, email=f"{uname}@portal.test", role="patient", is_active=True,
                 patient_id=pid)
        u.roles = [role_objs["patient"]]
        session.add(u)

    session.commit()


@pytest.fixture()
def db_session(tmp_path):
    db_url = f"sqlite:///{tmp_path}/test.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = TestingSession()
    seed_test_data(session)
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    # Clear in-memory rate-limit buckets between tests.
    from app.core import deps
    deps.clear_rate_limit_buckets()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client, username, password):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def auth_headers(client):
    body = _login(client, "admin", "Admin@12345")
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def clinician_headers(client):
    body = _login(client, "dr.smith", "Clinician@123")
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def nurse_headers(client):
    body = _login(client, "nurse.jones", "Nurse@12345")
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def viewer_headers(client):
    body = _login(client, "viewer.demo", "Viewer@12345")
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def patient_a_headers(client):
    body = _login(client, "patient.a", "PatientA@123")
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def patient_b_headers(client):
    body = _login(client, "patient.b", "PatientB@123")
    return {"Authorization": f"Bearer {body['access_token']}"}
