from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.db import get_session
from app.models.image import Image
from app.core.exceptions import NotFoundException
from app.core.celery_app import celery_app
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
    task = compress_image_task.delay(image_bytes, filename)
    return {"message": "Image is being processed", "task_id": task.id}


@router.get("/tasks/{task_id}")
def get_image_task(task_id: str):
    result = celery_app.AsyncResult(task_id)
    if result.state == "PENDING":
        return {"status": "PENDING"}
    if result.state == "STARTED":
        return {"status": "STARTED"}
    if result.state == "FAILURE":
        return {"status": "FAILURE"}
    if result.state == "SUCCESS":
        # Some Celery setups can report SUCCESS without persisting the return value.
        # In that case, keep the client polling rather than returning a null image_id.
        if result.result is None:
            return {"status": "STARTED"}
        return {"status": "SUCCESS", "image_id": int(result.result)}
    return {"status": result.state}


@router.get("/{image_id}")
def get_image(image_id: int, session: Session = Depends(get_session)):
    image = session.exec(select(Image).where(Image.id == image_id)).first()
    if not image:
        raise NotFoundException("Image not found")

    # We always compress to JPEG, so we can serve as image/jpeg.
    return Response(content=image.data, media_type="image/jpeg")

