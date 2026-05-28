from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user import User
from app.services.rag_chain import generate_rag_response
from app.services.retrieval import retrieve_relevant_chunks

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

    retrieved_chunks = retrieve_relevant_chunks(
        query=request.query,
        user_id=current_user.id,
    )

    response = generate_rag_response(
        query=request.query,
        retrieved_chunks=retrieved_chunks,
    )

    chat_message = ChatMessage(
        user_id=current_user.id,
        session_id=session.id,
        query=request.query,
        response=response,
    )
    db.add(chat_message)
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(chat_message)

    return {
        "id": chat_message.id,
        "session_id": session.id,
        "query": request.query,
        "response": response,
        "retrieved_chunks": retrieved_chunks,
        "created_at": chat_message.created_at,
    }
