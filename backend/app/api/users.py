from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException
from app.db import get_session
from app.models.image import Image
from app.models.user import User
from app.schemas.user import UserRead


router = APIRouter(redirect_slashes=False)


class SetAvatarRequest(BaseModel):
    image_id: int


@router.patch("/me/avatar", response_model=UserRead)
def set_my_avatar(
    data: SetAvatarRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    image = session.get(Image, data.image_id)
    if not image:
        raise NotFoundException("Image not found")

    current_user.avatar_image_id = data.image_id
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

