from app.services.email_service import EmailService


def send_email(to: str, subject: str, body: str) -> None:
    EmailService.send_email(to_email=to, subject=subject, body=body)

