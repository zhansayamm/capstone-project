class AppException(Exception):
    status_code: int
    error: str

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundException(AppException):
    status_code = 404
    error = "NotFound"


class ConflictException(AppException):
    status_code = 409
    error = "Conflict"


class UnauthorizedException(AppException):
    status_code = 401
    error = "Unauthorized"


class ForbiddenException(AppException):
    status_code = 403
    error = "Forbidden"
