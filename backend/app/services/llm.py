from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

import os
load_dotenv()

def get_llm(model_name: str = None):
    m_name = model_name or os.getenv("DEFAULT_LLM_MODEL", "llama-3.1-8b-instant")
    if m_name.startswith("gemini-"):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            # Fallback to default Groq Llama model if API key is missing
            m_name = "llama-3.1-8b-instant"
        else:
            return ChatGoogleGenerativeAI(
                model=m_name,
                google_api_key=api_key,
                temperature=0.2
            )
    return ChatGroq(
        groq_api_key=os.getenv("GROQ_API_KEY"),
        model_name=m_name,
        temperature=0.2
    )

# Fallback global instance for backward compatibility
llm = get_llm()

def extract_text_content(content) -> str:
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, dict):
                text_parts.append(part.get("text", ""))
            elif isinstance(part, str):
                text_parts.append(part)
        return "".join(text_parts)
    return str(content) if content is not None else ""