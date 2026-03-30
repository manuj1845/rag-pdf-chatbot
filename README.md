# 🧠 DocuMind — RAG-Powered PDF Chatbot

> Chat with any PDF using Retrieval Augmented Generation (RAG), vector embeddings, and LLMs.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)
![ChromaDB](https://img.shields.io/badge/ChromaDB-vector--db-purple)
![HuggingFace](https://img.shields.io/badge/HuggingFace-embeddings-yellow)
![Groq](https://img.shields.io/badge/Groq-LLM-green)

---

## 📌 What is this?

**DocuMind** is a lightweight, open-source RAG (Retrieval Augmented Generation) application that allows you to have a conversation with your PDF documents. It uses local vector embeddings and the blazing-fast Groq API for LLM inference.

### ✨ Features

- 📤 **Drag-and-Drop Upload**: Easily upload any PDF document.
- 🧩 **Smart Chunking**: Automatically extracts, cleans, and chunks text from PDFs.
- 🧠 **Local Vector Database**: Uses ChromaDB and HuggingFace embeddings for efficient semantic search.
- ⚡ **Ultra-Fast LLM**: Powered by Groq's Llama 3 API for near-instant responses.
- 🗑️ **Privacy First**: Documents are processed locally and you can reset/delete your session instantly.
- 🎨 **Beautiful UI**: Modern, responsive frontend with a clean chat interface.

---

## 🏗️ Architecture

```
User uploads PDF
      │
      ▼
┌─────────────────┐
│  PyMuPDF        │  ← Extracts text from PDF pages
│  Text Extractor │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Chunker   │  ← Splits into overlapping 500-word chunks
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Sentence Transformers      │  ← Converts chunks to vector embeddings
│  (all-MiniLM-L6-v2)        │     via Hugging Face
└────────┬────────────────────┘
         │
         ▼
┌─────────────────┐
│   ChromaDB      │  ← Stores embeddings in local vector database
│  Vector Store   │
└────────┬────────┘
         │
    User asks question
         │
         ▼
┌─────────────────┐
│  Semantic Search│  ← Top-4 most relevant chunks retrieved
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Groq LLM           │  ← llama-3.1-8b-instant answers with context
│  (Llama 3.1)        │
└─────────────────────┘
         │
         ▼
    Answer displayed to user
```

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/rag-pdf-chatbot.git
cd rag-pdf-chatbot
```

### 2. Create Virtual Environment
```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Get a Free Groq API Key
1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up for free
3. Create an API key

### 5. Set Up Environment Variables
```bash
copy .env.example .env
```
Edit `.env` and add your Groq API key:
```
GROQ_API_KEY=your_api_key_here
```

### 6. Run the App
```bash
python app.py
```

Open your browser at **http://localhost:5000** 🎉

---

## 🛠️ Tech Stack

| Component        | Technology                        |
|------------------|-----------------------------------|
| Backend          | Python + Flask                    |
| PDF Processing   | PyMuPDF (fitz)                    |
| Embeddings       | Sentence Transformers (HuggingFace) |
| Vector Database  | ChromaDB                          |
| LLM              | Groq API (Llama 3.1 8B Instant)   |
| Frontend         | HTML + CSS + Vanilla JavaScript   |

---

## 📁 Project Structure

```
rag-pdf-chatbot/
├── app.py              # Flask backend with RAG logic
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variables template
├── .gitignore
├── README.md
├── uploads/            # Uploaded PDFs (auto-created)
└── static/
    ├── index.html      # Main UI
    ├── style.css       # Dark theme styles
    └── script.js       # Frontend logic
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/YOUR_USERNAME/rag-pdf-chatbot/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by [Your Name](https://github.com/YOUR_USERNAME)*
