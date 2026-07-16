from sqlalchemy import inspect, text

from app.db.database import engine, Base
from app.models.user import User
from app.models.document import Document
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.models.document_parent_chunk import DocumentParentChunk


def _ensure_column(table_name: str, column_name: str, ddl: str):
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in columns:
        return

    with engine.begin() as connection:
        connection.execute(text(ddl))


def _run_sql(sql_statement: str):
    with engine.begin() as connection:
        connection.execute(text(sql_statement))


def run_migrations():
    print("Running database migrations...")
    Base.metadata.create_all(bind=engine)

    _ensure_column(
        "chat_messages",
        "session_id",
        "ALTER TABLE chat_messages ADD COLUMN session_id INTEGER",
    )

    _ensure_column(
        "chat_sessions",
        "model_name",
        "ALTER TABLE chat_sessions ADD COLUMN model_name VARCHAR",
    )

    # DB query optimization index
    _run_sql("CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages (session_id, created_at)")
    print("Database tables created.")
