from langchain.prompts import ChatPromptTemplate
from app.services.llm import llm

PROMPT_TEMPLATE = """
You are an expert, helpful AI assistant.
Answer the user's question ONLY based on the provided document sources. 

When answering:
1. Ground every claim directly in the provided context.
2. Refer to source documents by their names (e.g., "[user_manual.pdf]" or "according to [setup_guide.docx]") when citing information.
3. Structure your response using clean formatting (bullet points, bold text, or code blocks where applicable) to make it highly readable.
4. If the answer is not present in the provided context, state clearly: "I could not find relevant information in the uploaded documents."

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
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks, 1):
        filename = chunk.get("filename", "Unknown Document")
        context_parts.append(f"--- Source {i}: {filename} ---\n{chunk['text']}")
        
    context = "\n\n".join(context_parts)

    prompt = prompt_template.format_messages(
        context=context,
        question=query
    )

    response = llm.invoke(prompt)
    return response.content