import fitz
from docx import Document

def parse_pdf(file_path: str, filename: str = "Document"):
    pages_text = []
    pdf = fitz.open(file_path)

    for i, page in enumerate(pdf, 1):
        page_text = page.get_text().strip()
        if page_text:
            pages_text.append(f"[Source: {filename} | Page {i}]\n\n{page_text}")
    return "\n\n===PAGE_BREAK===\n\n".join(pages_text)

def parse_docx(file_path: str):
    text = ""
    doc = Document(file_path)

    for para in doc.paragraphs:
        text += para.text + "\n"
    return text

def parse_txt(file_path: str):
    with open(
        file_path,
        "r",
        encoding="utf-8"
    ) as file:
        return file.read()

def parse_document(
    file_path: str,
    file_type: str,
    filename: str = "Document"
):
    if file_type == "application/pdf":
        return parse_pdf(file_path, filename)

    elif file_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return parse_docx(file_path)

    elif file_type == "text/plain":
        return parse_txt(file_path)

    else:
        raise Exception("Unsupported file type")