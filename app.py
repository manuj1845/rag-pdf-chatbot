import os
import uuid
import json
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import chromadb
from chromadb.utils import embedding_functions
from groq import Groq
import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ChromaDB setup
chroma_client = chromadb.Client()
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Groq client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Store active sessions mapping session_id -> {"collection": name, "file_path": path}
active_sessions = {}

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using PyMuPDF"""
    try:
        doc = fitz.open(pdf_path)
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append({"page": i + 1, "text": text})
        doc.close()
        return pages
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return None

def chunk_text(pages, chunk_size=500, overlap=50):
    """Split text into overlapping chunks"""
    chunks = []
    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page"]
        words = text.split()
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i + chunk_size]
            chunk = " ".join(chunk_words)
            if len(chunk.strip()) > 50:  # Skip very short chunks
                chunks.append({
                    "text": chunk,
                    "page": page_num,
                    "chunk_id": f"page{page_num}_chunk{i}"
                })
    return chunks

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/upload', methods=['POST'])
def upload_pdf():
    """Upload and process a PDF file"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Please upload a valid PDF file"}), 400
    
    # Save file securely
    session_id = str(uuid.uuid4())[:8]
    safe_filename = secure_filename(file.filename)
    if not safe_filename:
        safe_filename = f"uploaded_document.pdf"
    
    filename = f"{session_id}_{safe_filename}"
    pdf_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(pdf_path)
    
    # Extract and chunk text
    pages = extract_text_from_pdf(pdf_path)
    if not pages:
        return jsonify({"error": "Could not extract text from PDF"}), 400
    
    chunks = chunk_text(pages)
    if not chunks:
        return jsonify({"error": "No readable content found in PDF"}), 400
    
    # Store in ChromaDB
    collection_name = f"pdf_{session_id}"
    collection = chroma_client.create_collection(
        name=collection_name,
        embedding_function=sentence_transformer_ef
    )
    
    documents = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = [{"page": c["page"]} for c in chunks]
    
    collection.add(documents=documents, ids=ids, metadatas=metadatas)
    active_sessions[session_id] = {
        "collection": collection_name,
        "file_path": pdf_path
    }
    
    return jsonify({
        "session_id": session_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks": len(chunks),
        "message": f"Successfully processed '{file.filename}' ({len(pages)} pages, {len(chunks)} chunks)"
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages with RAG"""
    data = request.json
    session_id = data.get("session_id")
    question = data.get("question", "").strip()
    
    if not session_id or session_id not in active_sessions:
        return jsonify({"error": "No PDF loaded. Please upload a PDF first."}), 400
    
    if not question:
        return jsonify({"error": "Please ask a question"}), 400
    
    # Retrieve relevant chunks from ChromaDB
    collection = chroma_client.get_collection(
        name=active_sessions[session_id]["collection"],
        embedding_function=sentence_transformer_ef
    )
    
    results = collection.query(
        query_texts=[question],
        n_results=min(4, collection.count())
    )
    
    context_chunks = results["documents"][0]
    source_pages = list(set([m["page"] for m in results["metadatas"][0]]))
    source_pages.sort()
    
    context = "\n\n---\n\n".join(context_chunks)
    
    # Build prompt
    system_prompt = """You are a helpful AI assistant that answers questions based on the content of an uploaded PDF document. 
Use ONLY the provided context to answer questions. 
If the answer is not found in the context, say "I couldn't find that information in the document."
Be concise, clear, and helpful. Format your response with markdown when appropriate."""

    user_prompt = f"""Context from the PDF:
{context}

Question: {question}

Answer based on the context above:"""
    
    # Call Groq LLM
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
        max_tokens=1024
    )
    
    answer = response.choices[0].message.content
    
    return jsonify({
        "answer": answer,
        "source_pages": source_pages,
        "context_used": len(context_chunks)
    })

@app.route('/reset', methods=['POST'])
def reset_session():
    """Reset a session"""
    data = request.json
    session_id = data.get("session_id")
    if session_id and session_id in active_sessions:
        session_data = active_sessions[session_id]
        try:
            chroma_client.delete_collection(session_data["collection"])
        except Exception as e:
            print(f"Error deleting collection: {e}")
            
        try:
            if os.path.exists(session_data["file_path"]):
                os.remove(session_data["file_path"])
        except Exception as e:
            print(f"Error removing file: {e}")
            
        active_sessions.pop(session_id, None)
    return jsonify({"message": "Session reset and files cleaned up"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
