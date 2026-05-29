from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=200,
    length_function=len,
)

def chunk_text(text: str):
    # Split into pages first if markers are present
    if "===PAGE_BREAK===" in text:
        pages = text.split("\n\n===PAGE_BREAK===\n\n")
        all_chunks = []
        for page in pages:
            if not page.strip():
                continue
            # Keep as a single page chunk if it is within reasonable size (around 2400 chars ~ 800 tokens)
            if len(page) <= 2400:
                all_chunks.append(page)
            else:
                # If page is too big, split it but keep the page header!
                # We can extract the header from the first line (e.g. "[Source: ... | Page X]")
                header = page.split("\n\n")[0] if page.startswith("[Source:") else ""
                sub_chunks = text_splitter.split_text(page)
                for sc in sub_chunks:
                    if header and not sc.startswith("[Source:"):
                        all_chunks.append(f"{header} (Continued)...\n\n{sc}")
                    else:
                        all_chunks.append(sc)
        return all_chunks
    else:
        return text_splitter.split_text(text)