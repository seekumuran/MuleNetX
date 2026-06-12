DANGEROUS = [
    "DETACH DELETE",
    "DELETE",
    "DROP",
    "REMOVE",
    "CALL dbms"
]


def validate_query(
    query
):

    upper = query.upper()

    for item in DANGEROUS:

        if item in upper:
            raise Exception(
                f"Blocked Query: {item}"
            )
