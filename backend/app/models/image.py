from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, LargeBinary


class Image(SQLModel, table=True):
    __tablename__ = "images"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    original_size: int
    compressed_size: int
    data: bytes = Field(sa_column=Column(LargeBinary))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

