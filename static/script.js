/* =============================================
   DocuMind - Frontend Logic
   ============================================= */

const API_BASE = 'http://localhost:5000';

let sessionId = null;
let isLoading = false;

// ---- DOM References ----
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const removeFile = document.getElementById('removeFile');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeState = document.getElementById('welcomeState');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const chatSubtitle = document.getElementById('chatSubtitle');
const headerStatus = document.getElementById('headerStatus');

// ---- Drag & Drop ----
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    handleFileUpload(file);
  } else {
    showToast('Please drop a PDF file', 'error');
  }
});

uploadZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    handleFileUpload(fileInput.files[0]);
  }
});

// ---- File Upload ----
async function handleFileUpload(file) {
  // Show file info
  uploadZone.style.display = 'none';
  fileInfo.style.display = 'flex';
  fileInfo.style.flexDirection = 'column';
  fileInfo.style.gap = '8px';
  fileName.textContent = file.name;
  fileMeta.textContent = 'Processing...';
  fileMeta.style.color = '#f59e0b';
  progressFill.style.width = '0%';
  progressLabel.textContent = 'Uploading PDF...';

  // Animate progress
  animateProgress(30, 600);

  const formData = new FormData();
  formData.append('file', file);

  try {
    animateProgress(70, 800);
    progressLabel.textContent = 'Embedding chunks into vector DB...';

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    animateProgress(100, 300);
    progressLabel.textContent = '✅ Ready to chat!';
    fileMeta.textContent = `${data.pages} pages · ${data.chunks} chunks indexed`;
    fileMeta.style.color = '#10b981';

    sessionId = data.session_id;

    // Update UI
    setStatus('active', `Chatting: ${truncate(file.name, 22)}`);
    chatSubtitle.textContent = truncate(file.name, 35);
    enableChat();

    // Add system message
    addSystemMessage(`📚 **"${file.name}"** loaded!<br>
    Processed <strong>${data.pages} pages</strong> into <strong>${data.chunks} vector chunks</strong>.<br>
    Ask me anything about this document!`);

  } catch (err) {
    progressLabel.textContent = '❌ ' + err.message;
    fileMeta.textContent = 'Upload failed';
    fileMeta.style.color = '#ef4444';
    progressFill.style.background = '#ef4444';
    console.error(err);
  }
}

function animateProgress(target, duration) {
  const start = parseFloat(progressFill.style.width) || 0;
  const diff = target - start;
  const startTime = Date.now();

  function step() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    progressFill.style.width = (start + diff * progress) + '%';
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- Remove File ----
removeFile.addEventListener('click', async () => {
  if (sessionId) {
    await fetch(`${API_BASE}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }

  sessionId = null;
  fileInput.value = '';
  uploadZone.style.display = '';
  fileInfo.style.display = 'none';
  progressFill.style.width = '0%';

  disableChat();
  setStatus('inactive', 'No document loaded');
  chatSubtitle.textContent = 'Upload a PDF to start chatting';
  clearMessages();
});

// ---- Chat ----
function enableChat() {
  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.focus();
  hideWelcome();
}

function disableChat() {
  questionInput.disabled = true;
  sendBtn.disabled = true;
  showWelcome();
}

// ---- Send Message ----
sendBtn.addEventListener('click', sendMessage);

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
questionInput.addEventListener('input', () => {
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 120) + 'px';
});

async function sendMessage() {
  const question = questionInput.value.trim();
  if (!question || isLoading || !sessionId) return;

  isLoading = true;
  sendBtn.disabled = true;

  // Add user message
  addMessage('user', question);
  questionInput.value = '';
  questionInput.style.height = 'auto';

  // Show typing indicator
  const typingEl = showTyping();

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, question }),
    });

    const data = await response.json();
    removeTyping(typingEl);

    if (!response.ok) {
      addErrorMessage(data.error || 'Something went wrong');
    } else {
      addMessage('ai', data.answer, data.source_pages);
    }
  } catch (err) {
    removeTyping(typingEl);
    addErrorMessage('Could not reach the server. Is the backend running?');
  }

  isLoading = false;
  sendBtn.disabled = false;
  questionInput.focus();
}

// ---- Message Helpers ----
function addMessage(role, text, sourcePages = null) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const content = document.createElement('div');
  content.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'ai') {
    bubble.innerHTML = markdownToHtml(text);
  } else {
    bubble.textContent = text;
  }

  content.appendChild(bubble);

  if (sourcePages && sourcePages.length > 0) {
    const sourceTag = document.createElement('div');
    sourceTag.className = 'source-tag';
    sourceTag.innerHTML = `📄 Sources: Page${sourcePages.length > 1 ? 's' : ''} ${sourcePages.join(', ')}`;
    content.appendChild(sourceTag);
  }

  messageEl.appendChild(avatar);
  messageEl.appendChild(content);
  messagesContainer.appendChild(messageEl);
  scrollToBottom();
}

function addSystemMessage(html) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message ai';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '⚡';

  const content = document.createElement('div');
  content.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = html;

  content.appendChild(bubble);
  messageEl.appendChild(avatar);
  messageEl.appendChild(content);
  messagesContainer.appendChild(messageEl);
  scrollToBottom();
}

function addErrorMessage(text) {
  const errEl = document.createElement('div');
  errEl.className = 'error-bubble';
  errEl.textContent = '⚠️ ' + text;
  messagesContainer.appendChild(errEl);
  scrollToBottom();
}

function showTyping() {
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.innerHTML = `
    <div class="message-avatar" style="background:var(--bg-card);border:1px solid var(--border);border-radius:50%;font-size:16px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">🤖</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  messagesContainer.appendChild(typingEl);
  scrollToBottom();
  return typingEl;
}

function removeTyping(el) {
  el?.remove();
}

function clearMessages() {
  messagesContainer.innerHTML = '';
  showWelcome();
}

function hideWelcome() {
  if (welcomeState) welcomeState.style.display = 'none';
}

function showWelcome() {
  if (welcomeState) {
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeState);
    welcomeState.style.display = '';
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ---- Status Helper ----
function setStatus(state, text) {
  const dot = headerStatus.querySelector('.status-dot');
  const label = headerStatus.querySelector('.status-text');
  dot.className = `status-dot ${state}`;
  label.textContent = text;
}

// ---- Example Questions ----
function setExampleQuestion(text) {
  if (!sessionId) return;
  questionInput.value = text;
  questionInput.focus();
}

// ---- Simple Markdown Parser ----
function markdownToHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h4 style="margin:10px 0 4px;font-size:14px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:12px 0 6px;font-size:15px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:12px 0 6px;font-size:16px;">$1</h2>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}
