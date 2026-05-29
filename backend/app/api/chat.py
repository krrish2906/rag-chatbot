from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user import User
from app.models.document import Document
from app.services.rag_chain import generate_rag_response, prompt_template
from app.services.llm import llm
from app.services.retrieval import retrieve_relevant_chunks
from app.services.session_title import generate_chat_title
from app.services.query_optimizer import reformulate_query

router = APIRouter(
    prefix="/chat",
    tags=["Chat"],
)


class ChatRequest(BaseModel):
    query: str
    session_id: int


class SessionCreateRequest(BaseModel):
    title: str = "New chat"


class SessionUpdateRequest(BaseModel):
    title: str


def _get_user_session(db: Session, session_id: int, user_id: int) -> ChatSession:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.post("/sessions")
def create_session(
    request: SessionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(
        user_id=current_user.id,
        title=request.title.strip() or "New chat",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [
        {
            "id": session.id,
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }
        for session in sessions
    ]


@router.patch("/sessions/{session_id}")
def update_session(
    session_id: int,
    request: SessionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    session.title = request.title.strip() or session.title
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
    db.delete(session)
    db.commit()
    return {"message": "Chat session deleted"}


@router.get("/sessions/{session_id}/history")
def get_session_history(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_user_session(db, session_id, current_user.id)
    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.user_id == current_user.id,
            ChatMessage.session_id == session_id,
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "id": message.id,
            "query": message.query,
            "response": message.response,
            "created_at": message.created_at,
        }
        for message in messages
    ]


@router.post("/")
def chat_with_documents(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, request.session_id, current_user.id)

    message_count = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .count()
    )
    is_first_message = message_count == 0

    def event_generator():
        # 1. Retrieve history & reformulate
        search_query = request.query
        if not is_first_message:
            history_messages = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == session.id)
                .order_by(ChatMessage.created_at.desc())
                .limit(4)
                .all()
            )
            history_turns = [
                {"query": msg.query, "response": msg.response}
                for msg in reversed(history_messages)
            ]
            search_query = reformulate_query(request.query, history_turns)

        # 2. Retrieve chunks & resolve filenames
        retrieved_chunks = retrieve_relevant_chunks(
            query=search_query,
            user_id=current_user.id,
        )
        doc_ids = list({chunk["document_id"] for chunk in retrieved_chunks})
        documents = db.query(Document).filter(Document.id.in_(doc_ids)).all()
        doc_map = {doc.id: doc.filename for doc in documents}
        for chunk in retrieved_chunks:
            chunk["filename"] = doc_map.get(chunk["document_id"], "Unknown Document")

        # Yield metadata event containing chunk sources
        yield f"event: metadata\ndata: {json.dumps({'retrieved_chunks': retrieved_chunks})}\n\n"

        # 3. Stream LLM tokens
        context_parts = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            filename = chunk.get("filename", "Unknown Document")
            context_parts.append(f"--- Source {i}: {filename} ---\n{chunk['text']}")
        context = "\n\n".join(context_parts)

        prompt = prompt_template.format_messages(
            context=context,
            question=request.query
        )

        full_response = ""
        try:
            for token_chunk in llm.stream(prompt):
                token = token_chunk.content
                full_response += token
                # Yield token event
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"
            return

        # 4. Save to SQL Database
        chat_message = ChatMessage(
            user_id=current_user.id,
            session_id=session.id,
            query=request.query,
            response=full_response,
        )
        session_title = None
        if is_first_message:
            session_title = generate_chat_title(request.query)
            session.title = session_title

        db.add(chat_message)
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(chat_message)

        # Yield done event
        yield f"event: done\ndata: {json.dumps({'message_id': chat_message.id, 'session_title': session_title})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
