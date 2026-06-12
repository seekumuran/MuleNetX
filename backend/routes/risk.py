from backend.core.cache import (
    cache_get,
    cache_set
)

@router.get("/risk/top")
def top_risk():

    cached = cache_get(
        "risk_top"
    )

    if cached:
        return cached

    result = ...

    data = [
        dict(x)
        for x in result
    ]

    cache_set(
        "risk_top",
        data,
        300
    )

    return data
