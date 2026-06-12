from backend.neo4j_client import neo4j_client


query = """
MATCH (n)
RETURN count(n) AS count
"""

result = neo4j_client.execute(query)

for row in result:
    print(row["count"])
