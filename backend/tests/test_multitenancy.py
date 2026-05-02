from __future__ import annotations

from datetime import datetime, time as time_of_day, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.db as db_module
import app.main as main_module
from app.db import get_session
from app.models.enums import UserRole
from app.models.slot import Slot
from app.models.university import University
from app.utils.datetime_utils import LOCAL_TZ, utc_now


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    # Ensure FastAPI startup uses the test engine (not the .env DATABASE_URL engine).
    db_module.engine = engine
    main_module.engine = engine

    def override_get_session():
        with Session(engine) as session:
            yield session

    main_module.app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(main_module.app) as c:
            yield c
    finally:
        main_module.app.dependency_overrides.clear()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_multi_university_isolation_and_forbidden(client: TestClient):
    # 1) Create two universities (SDU, KBTU)
    with Session(db_module.engine) as session:
        sdu = University(name="SDU")
        kbtu = University(name="KBTU")
        session.add(sdu)
        session.add(kbtu)
        session.commit()
        session.refresh(sdu)
        session.refresh(kbtu)

    # 2) Register two users:
    # - user1 -> SDU (professor, to create slot)
    # - user2 -> KBTU (student, to create bookings)
    r = client.post(
        "/auth/register",
        json={
            "email": "user1@sdu.kz",
            "password": "secret1",
            "role": UserRole.professor,
            "university_id": sdu.id,
        },
    )
    assert r.status_code == 200, r.text

    r = client.post(
        "/auth/register",
        json={
            "email": "user2@kbtu.kz",
            "password": "secret2",
            "role": UserRole.student,
            "university_id": kbtu.id,
        },
    )
    assert r.status_code == 200, r.text

    # 3) Login both users and get JWT tokens
    r = client.post("/auth/login", json={"email": "user1@sdu.kz", "password": "secret1"})
    assert r.status_code == 200, r.text
    token_user1 = r.json()["access_token"]

    r = client.post("/auth/login", json={"email": "user2@kbtu.kz", "password": "secret2"})
    assert r.status_code == 200, r.text
    token_user2 = r.json()["access_token"]

    # 4) As user1 (SDU professor): create slots in future local business hours (Asia/Almaty)
    tz = LOCAL_TZ
    day = utc_now().astimezone(tz).date()
    t_local_10 = datetime.combine(day, time_of_day(10, 0), tzinfo=tz)
    if t_local_10.astimezone(timezone.utc) <= utc_now():
        day = day + timedelta(days=1)
        t_local_10 = datetime.combine(day, time_of_day(10, 0), tzinfo=tz)
    start = t_local_10.astimezone(timezone.utc)
    end = (t_local_10 + timedelta(hours=1)).astimezone(timezone.utc)
    kbtu_start_local = datetime.combine(day, time_of_day(14, 0), tzinfo=tz)
    kbtu_end_local = datetime.combine(day, time_of_day(15, 0), tzinfo=tz)
    kbtu_start = kbtu_start_local.astimezone(timezone.utc)
    kbtu_end = kbtu_end_local.astimezone(timezone.utc)
    r = client.post(
        "/slots",
        headers=_auth_header(token_user1),
        json={
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "title": "SDU OH",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    slots_payload = body if isinstance(body, list) else [body]
    sdu_slot_id = slots_payload[0]["id"]

    # Create a KBTU slot directly in DB so the KBTU student can book within their university.
    with Session(db_module.engine) as session:
        kbtu_prof_slot = Slot(
            professor_id=1,  # not used by booking validation other than existence
            university_id=kbtu.id,
            start_time=kbtu_start,
            end_time=kbtu_end,
            title="KBTU slot",
            is_booked=False,
        )
        session.add(kbtu_prof_slot)
        session.commit()
        session.refresh(kbtu_prof_slot)
        kbtu_slot_id = kbtu_prof_slot.id

    # 5) As user2 (KBTU student):
    # - try to access SDU slot -> should NOT be visible
    r = client.get("/slots", headers=_auth_header(token_user2))
    assert r.status_code == 200, r.text
    slot_ids = {s["id"] for s in r.json()}
    assert sdu_slot_id not in slot_ids
    assert kbtu_slot_id in slot_ids

    # - try to book SDU slot -> should FAIL with Forbidden
    r = client.post(
        "/bookings",
        headers=_auth_header(token_user2),
        json={"slot_id": sdu_slot_id},
    )
    assert r.status_code == 403, r.text
    body = r.json()
    assert body["error"] == "Forbidden"

    # - book KBTU slot -> should succeed
    r = client.post(
        "/bookings",
        headers=_auth_header(token_user2),
        json={"slot_id": kbtu_slot_id},
    )
    assert r.status_code == 200, r.text

    # 6/7) Verify data isolation via GET /bookings/me and /slots
    r = client.get("/bookings/me", headers=_auth_header(token_user2))
    assert r.status_code == 200, r.text
    bookings = r.json()
    assert len(bookings) == 1
    assert bookings[0]["slot"]["university_id"] == kbtu.id
    assert bookings[0]["university_id"] == kbtu.id
