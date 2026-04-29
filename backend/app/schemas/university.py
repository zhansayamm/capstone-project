from pydantic import BaseModel


class UniversityCreate(BaseModel):
    name: str


class UniversityRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
