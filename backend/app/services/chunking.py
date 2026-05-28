from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len,
)

def chunk_text(text: str):
    chunks = text_splitter.split_text(text)
    return chunks