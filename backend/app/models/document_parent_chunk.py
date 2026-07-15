from sqlalchemy import Column, Integer, Text, ForeignKey
from app.db.database import Base

class DocumentParentChunk(Base):
    __tablename__ = "document_parent_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text = Column(Text, nullable=False)
