from enum import Enum

class UserRole(str, Enum):
    student = "student"
    professor = "professor"
    admin = "admin"


class BookingStatus(str, Enum):
    booked = "booked"
    queued = "queued"