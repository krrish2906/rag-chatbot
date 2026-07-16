import os
import tempfile
from sqlalchemy.orm import Session
from flashrank import Ranker, RerankRequest

from app.services.embedding import generate_embedding
from app.services.pinecone_service import index
from app.models.document_parent_chunk import DocumentParentChunk

# Initialize Ranker lazily to avoid blocking startup port-binding
_ranker = None

def get_ranker() -> Ranker:
    global _ranker
    if _ranker is None:
        _ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=os.path.join(tempfile.gettempdir(), "flashrank"))
    return _ranker

def retrieve_relevant_chunks(
    query: str,
    user_id: int,
    db: Session,
    top_k: int = 20,
    top_n: int = 4
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

    if not results or "matches" not in results or not results["matches"]:
        return []

    # 1. Prepare passages for re-ranking
    passages = []
    for idx, match in enumerate(results["matches"]):
        passages.append({
            "id": idx,
            "text": match["metadata"].get("text", ""),
            "meta": {
                "original_score": match["score"],
                "document_id": match["metadata"].get("document_id"),
                "parent_id": match["metadata"].get("parent_id"),
            }
        })

    # 2. Rerank matches
    rerank_request = RerankRequest(query=query, passages=passages)
    ranker = get_ranker()
    reranked_results = ranker.rerank(rerank_request)

    # Take top N results
    top_results = reranked_results[:top_n]

    retrieved_chunks = []
    for match in top_results:
        meta = match["meta"]
        parent_id = meta.get("parent_id")
        
        # 3. Retrieve parent text from Postgres
        parent_text = ""
        if parent_id is not None:
            parent_chunk = db.query(DocumentParentChunk).filter(DocumentParentChunk.id == parent_id).first()
            if parent_chunk:
                parent_text = parent_chunk.text
        
        # Fallback to child text if parent is missing
        if not parent_text:
            parent_text = match["text"]

        retrieved_chunks.append({
            "score": float(match.get("score", 0.0)),
            "text": match["text"],
            "parent_text": parent_text,
            "document_id": meta.get("document_id"),
        })
        
    return retrieved_chunks