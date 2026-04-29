import io

from celery.utils.log import get_task_logger
from PIL import Image as PILImage
from sqlmodel import Session

from app.core.celery_app import celery_app
from app.db import engine
from app.models.image import Image


logger = get_task_logger(__name__)


@celery_app.task(name="app.tasks.image_tasks.compress_image_task")
def compress_image_task(image_bytes: bytes, filename: str) -> None:
    logger.info("Image task executed: filename=%s", filename)
    original_size = len(image_bytes)

    image = PILImage.open(io.BytesIO(image_bytes))
    # Normalize to RGB so we can safely save as JPEG even for PNG inputs with alpha.
    if image.mode in ("RGBA", "LA"):
        image = image.convert("RGB")

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=50, optimize=True)
    compressed_bytes = buffer.getvalue()
    compressed_size = len(compressed_bytes)

    logger.info("Original: %s bytes -> Compressed: %s bytes", original_size, compressed_size)

    with Session(engine) as session:
        image_obj = Image(
            filename=filename,
            original_size=original_size,
            compressed_size=compressed_size,
            data=compressed_bytes,
        )
        session.add(image_obj)
        session.commit()

