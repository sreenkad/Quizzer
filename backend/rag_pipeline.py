import os
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

# Schema for the output
class Option(BaseModel):
    text: str = Field(description="The text of the option")
    is_correct: bool = Field(description="True if this is the correct answer, False otherwise")

class Question(BaseModel):
    question: str = Field(description="The MCQ question text")
    options: List[Option] = Field(description="The options for the question, usually 4 options. Must contain exactly one correct option.")

class Quiz(BaseModel):
    questions: List[Question] = Field(description="List of questions in the quiz")

VECTOR_STORE_PATH = "faiss_index"

def process_pdf(file_path: str):
    """Loads a PDF, splits it into chunks, and creates a FAISS vector store."""
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(pages)

    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
    
    # Check if vector store exists, if so merge, otherwise create new
    if os.path.exists(VECTOR_STORE_PATH):
        vectorstore = FAISS.load_local(VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
        vectorstore.add_documents(splits)
    else:
        vectorstore = FAISS.from_documents(splits, embeddings)
        
    vectorstore.save_local(VECTOR_STORE_PATH)
    return len(splits)

def generate_quiz(num_questions: str = "5") -> dict:
    """Generates a quiz from the vector store."""
    if not os.path.exists(VECTOR_STORE_PATH):
        raise ValueError("Vector store not found. Please upload a PDF first.")

    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
    vectorstore = FAISS.load_local(VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
    
    # Retrieve relevant documents
    query = "General summary and key points of the document"
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    docs = retriever.invoke(query)
    context = "\n\n".join(doc.page_content for doc in docs)

    prompt = ChatPromptTemplate.from_messages([
        ("user", "You are an expert teacher. Generate a multiple-choice quiz based on the provided context. "
                 "The quiz should contain {num_questions} questions. "
                 "Ensure exactly one option is marked as correct for each question.\n\n"
                 "Context: {context}")
    ])

    models_to_try = [
        "gemini-3.5-flash",
        "gemini-3.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-2.5-computer-use-preview-10-2025",
        "deep-research-preview-04-2026"
    ]
    
    last_error = None
    for model_name in models_to_try:
        try:
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2)
            structured_llm = llm.with_structured_output(Quiz)
            chain = prompt | structured_llm
            result = chain.invoke({
                "num_questions": num_questions,
                "context": context
            })
            return result.model_dump()
        except Exception as e:
            last_error = e
            if "503" in str(e) or "429" in str(e) or "INVALID_ARGUMENT" in str(e):
                continue
            raise e
            
    raise ValueError(f"All models failed. Last error: {str(last_error)}")
