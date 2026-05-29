from app.services.llm import llm
from langchain.prompts import ChatPromptTemplate

REFORMULATE_PROMPT_TEMPLATE = """
Given the following conversation history and a new user query, reformulate it into a single, standalone search query that contains all the necessary background context. 
This standalone query will be used for document retrieval, so make sure to preserve critical nouns, topics, and terms.
Do NOT answer the query, only reformulate it.
If the new query does not refer to the history and is already self-contained, return the original query exactly.

Conversation History:
{chat_history}

New User Query: {query}

Standalone Search Query:
"""

reformulate_prompt = ChatPromptTemplate.from_template(REFORMULATE_PROMPT_TEMPLATE)

def reformulate_query(query: str, history_turns: list) -> str:
    if not history_turns:
        return query
    
    # Format history turns
    history_text = ""
    for turn in history_turns:
        history_text += f"User: {turn['query']}\nAssistant: {turn['response']}\n\n"
        
    prompt = reformulate_prompt.format_messages(
        chat_history=history_text.strip(),
        query=query
    )
    
    try:
        response = llm.invoke(prompt)
        standalone_query = response.content.strip()
        # Clean up potential markdown formatting or quotes in the output
        if standalone_query.startswith('"') and standalone_query.endswith('"'):
            standalone_query = standalone_query[1:-1]
        return standalone_query or query
    except Exception:
        # Fall back to original query if any API errors occur
        return query
