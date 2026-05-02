from sqlmodel import Session, create_engine

from app.core.config import get_database_url

_effective_url = get_database_url()

_engine_kwargs: dict = {}
if _effective_url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 280

engine = create_engine(_effective_url, **_engine_kwargs)


def get_session():
    with Session(engine) as session:
        yield session
