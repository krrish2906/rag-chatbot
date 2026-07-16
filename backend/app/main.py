from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.documents import (router as document_router)
from app.api.chat import (router as chat_router)
from app.db import init_db


import os
from dotenv import load_dotenv

app = FastAPI()
load_dotenv()

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(document_router)
app.include_router(chat_router)

@app.on_event("startup")
def on_startup():
    from app.db.init_db import run_migrations
    run_migrations()

@app.get("/")
def root():
    return {"message": "RAG Chatbot API is running"}