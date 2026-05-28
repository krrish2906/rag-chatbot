import os
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.services.chunking import chunk_text
from app.services.parser import parse_document
from app.services.storage import get_storage_backend
from app.services.vector_store import store_chunks_in_pinecone

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)

ALLOWED_TYPES = [
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]


@router.post("/upload")
async def upload_document(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    storage = get_storage_backend()
    uploaded_documents = []
    temp_paths = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.filename}",
            )

        file_bytes = await file.read()
        storage_key = storage.save(
            file_bytes=file_bytes,
            filename=file.filename,
            user_id=current_user.id,
            content_type=file.content_type,
        )

        new_document = Document(
            filename=file.filename,
            filepath=storage_key,
            filetype=file.content_type,
            user_id=current_user.id,
        )

        db.add(new_document)
        db.commit()
        db.refresh(new_document)

        parse_path = storage.get_local_path(storage_key)
        if parse_path != storage_key:
            temp_paths.append(parse_path)

        extracted_text = parse_document(parse_path, file.content_type)
        chunks = chunk_text(extracted_text)

        store_chunks_in_pinecone(
            chunks=chunks,
            document_id=new_document.id,
            user_id=current_user.id,
        )

        uploaded_documents.append(
            {
                "id": new_document.id,
                "document_id": new_document.id,
                "filename": new_document.filename,
            }
        )

    for temp_path in temp_paths:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    return {
        "message": "Files uploaded successfully",
        "documents": uploaded_documents,
    }


@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    return [
        {
            "id": document.id,
            "filename": document.filename,
            "filetype": document.filetype,
            "uploaded_at": document.uploaded_at,
        }
        for document in documents
    ]
