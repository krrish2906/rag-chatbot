from app.services.llm import llm

TITLE_PROMPT = """Generate a short chat title (3-6 words) for a conversation that starts with the user message below.
Rules:
- Return ONLY the title text
- No quotes, no punctuation at the end
- Be specific to the topic

User message:
{message}
"""


def generate_chat_title(first_message: str) -> str:
    cleaned = first_message.strip()
    if not cleaned:
        return "New chat"

    try:
        response = llm.invoke(
            TITLE_PROMPT.format(message=cleaned[:500])
        )
        title = (response.content or "").strip().strip("\"'")
        title = " ".join(title.split())
        if title:
            return title[:60]
    except Exception:
        pass

    fallback = cleaned.replace("\n", " ")
    if len(fallback) > 48:
        return f"{fallback[:48]}..."
    return fallback or "New chat"
