from langchain.prompts import ChatPromptTemplate
from app.services.llm import llm

PROMPT_TEMPLATE = """
You are a helpful AI assistant.
Answer ONLY from the provided context.

If the answer is not present in context, say:
"I could not find relevant information in the uploaded documents."

Context:
{context}

Question:
{question}
"""

prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)

def generate_rag_response(
    query: str,
    retrieved_chunks: list
):
    context = "\n\n".join([
        chunk["text"]
        for chunk in retrieved_chunks
    ])

    prompt = prompt_template.format_messages(
        context=context,
        question=query
    )

    response = llm.invoke(prompt)
    return response.content