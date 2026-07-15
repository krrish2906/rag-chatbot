import uuid

from app.services.embedding import (generate_embedding)
from app.services.pinecone_service import (index)

def store_chunks_in_pinecone(
    chunks,
    document_id,
    user_id
):
    vectors = []
    for chunk in chunks:
        embedding = generate_embedding(chunk)
        vectors.append({
            "id": str(uuid.uuid4()),
            "values": embedding,
            "metadata": {
                "text": chunk,
                "document_id": document_id,
                "user_id": user_id,
            }
        })

    index.upsert(vectors=vectors)


def store_child_chunks_in_pinecone(
    parent_id: int,
    child_texts: list[str],
    document_id: int,
    user_id: int
):
    vectors = []
    for chunk in child_texts:
        embedding = generate_embedding(chunk)
        vectors.append({
            "id": str(uuid.uuid4()),
            "values": embedding,
            "metadata": {
                "text": chunk,
                "parent_id": parent_id,
                "document_id": document_id,
                "user_id": user_id,
            }
        })

    index.upsert(vectors=vectors)