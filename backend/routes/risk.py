from fastapi import APIRouter

from backend.neo4j_client import neo4j_client

router = APIRouter()


@router.get("/risk/top")

def top_risk():

    query = """
    MATCH (a:Account)

    RETURN
        a.account_id AS account,
        a.risk_score AS risk

    ORDER BY risk DESC

    LIMIT 100
    """

    result = neo4j_client.execute(query)

    return [dict(x) for x in result]
