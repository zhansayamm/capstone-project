from enum import Enum

class UserRole(str, Enum):
    student = "student"
    professor = "professor"
    admin = "admin"


class BookingStatus(str, Enum):
    # New workflow states
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"

    # Backward compatibility (existing DB rows / older clients)
    booked = "booked"
    queued = "queued"