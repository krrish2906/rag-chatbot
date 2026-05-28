import fitz
from docx import Document

def parse_pdf(file_path: str):
    text = ""
    pdf = fitz.open(file_path)

    for page in pdf:
        text += page.get_text()
    return text

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
    file_type: str
):
    if file_type == "application/pdf":
        return parse_pdf(file_path)

    elif file_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return parse_docx(file_path)

    elif file_type == "text/plain":
        return parse_txt(file_path)

    else:
        raise Exception("Unsupported file type")