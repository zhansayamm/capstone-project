from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.db import get_session
from app.models.image import Image
from app.core.exceptions import NotFoundException
from app.tasks.image_tasks import compress_image_task


router = APIRouter()

MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
):
    # Note: we don't store a DB row here; the Celery task will create it.
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Only image/jpeg and image/png are allowed")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    filename = file.filename or "upload"
    compress_image_task.delay(image_bytes, filename)
    return {"message": "Image is being processed"}


@router.get("/{image_id}")
def get_image(image_id: int, session: Session = Depends(get_session)):
    image = session.exec(select(Image).where(Image.id == image_id)).first()
    if not image:
        raise NotFoundException("Image not found")

    # We always compress to JPEG, so we can serve as image/jpeg.
    return Response(content=image.data, media_type="image/jpeg")

