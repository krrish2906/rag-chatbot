from app.services.embedding import (generate_embedding)
from app.services.pinecone_service import (index)

def retrieve_relevant_chunks(
    query: str,
    user_id: int,
    top_k: int = 12
):
    query_embedding = generate_embedding(query)

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        filter={
            "user_id": user_id
        }
    )

    retrieved_chunks = []
    for match in results["matches"]:
        retrieved_chunks.append({
            "score": match["score"],
            "text": match["metadata"]["text"],
            "document_id": match["metadata"]["document_id"]
        })
        
    return retrieved_chunks