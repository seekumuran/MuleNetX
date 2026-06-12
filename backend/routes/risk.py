from fastapi import APIRouter
from fastapi import Depends

from backend.core.dependencies import (
    current_user
)

router = APIRouter()


@router.get("/risk/top")
def top_risk(
    user=Depends(
        current_user
    )
):
