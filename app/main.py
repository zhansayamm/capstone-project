from fastapi import FastAPI
from sqlmodel import SQLModel
from app.db import engine

from app.models import *

from app.api import auth, slots, bookings, classrooms, reservations, admin


app = FastAPI(
    title="Booking Time API",
    description="University booking system (office hours + classrooms)",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(slots.router, prefix="/slots", tags=["Slots"])
app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
app.include_router(classrooms.router, prefix="/classrooms", tags=["Classrooms"])
app.include_router(reservations.router, prefix="/reservations", tags=["Reservations"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

@app.get("/")
def root():
    return {
        "message": "Booking Time API is running",
        "docs": "/docs"
    }