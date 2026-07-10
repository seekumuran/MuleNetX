from fastapi import APIRouter

from services.executive_service import service


router = APIRouter(
    prefix="/executive",
    tags=["Executive Intelligence"]
)


@router.get("/summary")
def executive_summary():

    return service.generate_summary()
