from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

parent_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,
    chunk_overlap=200,
    length_function=len,
)

child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=50,
    length_function=len,
)

def chunk_text_parent_child(text: str) -> list[dict]:
    """
    Splits text into Parent chunks (~1500 chars) and nested Child chunks (~300 chars).
    Returns a list of dicts: [{'parent_text': str, 'child_texts': [str, ...]}]
    """
    results = []
    
    if "===PAGE_BREAK===" in text:
        pages = text.split("\n\n===PAGE_BREAK===\n\n")
        for page in pages:
            if not page.strip():
                continue
            
            # 1. Determine parent chunks for this page
            if len(page) <= 1500:
                parent_texts = [page]
            else:
                header = page.split("\n\n")[0] if page.startswith("[Source:") else ""
                sub_parents = parent_splitter.split_text(page)
                parent_texts = []
                for sp in sub_parents:
                    if header and not sp.startswith("[Source:"):
                        parent_texts.append(f"{header} (Continued)...\n\n{sp}")
                    else:
                        parent_texts.append(sp)
            
            # 2. Split each parent text into child chunks
            for p_text in parent_texts:
                c_texts = child_splitter.split_text(p_text)
                results.append({
                    "parent_text": p_text,
                    "child_texts": c_texts
                })
    else:
        parent_texts = parent_splitter.split_text(text)
        for p_text in parent_texts:
            c_texts = child_splitter.split_text(p_text)
            results.append({
                "parent_text": p_text,
                "child_texts": c_texts
            })
            
    return results