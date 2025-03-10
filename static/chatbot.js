let recognition;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentLanguage = 'ar';
let sessionId = Date.now().toString();
let conversation_history = {};
let ws = null;
let apiToken = null;

 
async function fetchApiToken() {
    try {
        console.log("Fetching API token...");
        const response = await fetch('https://asimabdulkhaleq-aiuniversityagent.hf.space/api/gettoken', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch token: ${response.status} - ${await response.text()}`);
        }
        const data = await response.json();
        apiToken = data.token;
        window.authToken = data.token; // Set globally
        console.log("Auth Token:", window.authToken);
        console.log("API Token fetched:", apiToken.substring(0, 5) + "...");
        // Add welcome message after token fetch
        addMessageToChat(currentLanguage === 'en' ? 
            'Welcome to the University AI Assistant! How can I help you today?' : 
            'أهلاً بك في المساعد الجامعي الذكي! كيف يمكنني مساعدتك اليوم؟');
    } catch (error) {
        console.error('Error fetching API token:', error.message);
        addMessageToChat(currentLanguage === 'en' ? 'Failed to initialize: Token error' : 'فشل التهيئة: خطأ في الرمز');
    }
}

function initializeRecognition() {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentLanguage === 'ar' ? 'ar-SA' : 'en-US';

    recognition.onresult = (e) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalTranscript += transcript + ' ';
            else interimTranscript += transcript;
        }
        document.getElementById('questionInput').value = finalTranscript + interimTranscript;
    };

    recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        stopRecording();
    };
}

function initTextareaResize() {
    const textarea = document.getElementById('questionInput');
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = `${this.scrollHeight}px`;
    });
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askQuestion();
        }
    });

    const sendButton = document.getElementById('sendButton');
    const recordButton = document.getElementById('recordButton');
    const adjustHeight = () => {
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
        const lines = Math.ceil(textarea.scrollHeight / lineHeight);
        const newHeight = Math.max(44, lines * lineHeight);
        textarea.style.height = `${newHeight}px`;
        sendButton.style.height = `${newHeight - 16}px`;
        recordButton.style.height = `${newHeight - 16}px`;
    };
    textarea.addEventListener('input', adjustHeight);
    adjustHeight();
}

function toggleRecording() {
    if (!isRecording) startRecording();
    else stopRecording();
}

function startRecording() {
    document.getElementById('questionInput').value = '';
    audioChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            isRecording = true;
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const text = document.getElementById('questionInput').value.trim();
                if (text) addMessageToChat(text, true);
                addMessageToChat(audioUrl, true, true);
                stream.getTracks().forEach(track => track.stop());
            };
            recognition.start();
            document.getElementById('recordingIndicator').classList.remove('hidden');
            document.getElementById('recordButton').classList.add('text-red-500');
            document.getElementById('recordButton').innerHTML = '<i class="fas fa-stop"></i>';
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            alert('Microphone access is required for recording.');
        });
}

function stopRecording() {
    if (mediaRecorder && recognition) {
        mediaRecorder.stop();
        recognition.stop();
        isRecording = false;
        askQuestion();
        document.getElementById('recordingIndicator').classList.add('hidden');
        document.getElementById('recordButton').classList.remove('text-red-500');
        document.getElementById('recordButton').innerHTML = '<i class="fas fa-microphone"></i>';
    }
}

function addMessageToChat(content, isUser = false, isAudio = false) {
    const bubble = document.createElement('div');
    bubble.className = isUser ? 'user-bubble chat-bubble' : 'bot-bubble chat-bubble';
    if (isAudio) {
        bubble.innerHTML = `
            <i class="fas fa-microphone text-xl ${isUser ? 'text-white' : 'text-gray-600'}"></i>
            <audio controls src="${content}"></audio>
        `;
    } else {
        const formattedContent = content.replace(/\n/g, '<br>').replace(/\s+/g, ' ').trim();
        bubble.innerHTML = `
            <i class="fas ${isUser ? 'fa-user' : 'fa-robot'} text-xl ${isUser ? 'text-white' : 'text-gray-600'}"></i>
            <span class="message-text">${formattedContent}</span>
        `;
    }
    document.getElementById('chatContainer').appendChild(bubble);
    document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
}

function renderSupportForm(formData) {
    const alignmentClass = currentLanguage === 'ar' ? 'rtl' : 'ltr';
    const title = currentLanguage === 'ar' ? 'أنشاء تذكرة دعم ومساعدة' : 'Create Support Ticket';
    const formHtml = `
        <div id="supportForm" class="support-form-bubble ${alignmentClass}" style="${alignmentClass === 'rtl' ? 'margin-left: auto; margin-right: 0;' : 'margin-right: auto; margin-left: 0;'}">
            <h3 class="font-bold mb-4 ${alignmentClass === 'rtl' ? 'text-right' : 'text-left'}">${title}</h3>
            ${formData.fields.map(field => `
                <div class="form-group mb-4">
                    <label class="block text-sm font-medium mb-1 ${alignmentClass === 'rtl' ? 'text-right' : 'text-left'}">${field.label}</label>
                    ${field.type === 'textarea' ?
                        `<textarea name="${field.name}" class="w-full p-2 border rounded-lg auto-resize" style="direction: ${alignmentClass};" required>${field.value || ''}</textarea>` :
                        `<input type="${field.type}" name="${field.name}" class="w-full p-2 border rounded-lg" style="direction: ${alignmentClass};" value="${field.value || ''}" required>`}
                </div>
            `).join('')}
            <div class="flex gap-2 ${alignmentClass === 'rtl' ? 'justify-end' : 'justify-start'}">
                <button onclick="submitSupportForm(this.parentElement.parentElement)" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">${formData.messages.submit}</button>
                <button onclick="cancelSupportForm()" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">${formData.messages.cancel}</button>
            </div>
        </div>
    `;
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.insertAdjacentHTML('beforeend', formHtml);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    document.getElementById('sendButton').disabled = true;
}

async function submitSupportForm(formElement) {
    const formData = {
        user_id: formElement.querySelector('[name="user_id"]').value,
        user_name: formElement.querySelector('[name="user_name"]').value,
        email: formElement.querySelector('[name="email"]').value,
        issue_description: formElement.querySelector('[name="issue_description"]').value,
        language: currentLanguage
    };
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/create_ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`  // Include the fetched token
            },
            body: JSON.stringify(formData)
        });
        if (!response.ok) throw new Error('Ticket creation failed');
        const result = await response.json();
        addMessageToChat(result.message, false);
        formElement.remove();
        document.getElementById('sendButton').disabled = false;
    } catch (error) {
        const errorMsg = currentLanguage === 'ar' ? `خطأ: ${error.message}` : `Error: ${error.message}`;
        addMessageToChat(errorMsg, false);
        formElement.remove();
        document.getElementById('sendButton').disabled = false;
    }
}

function cancelSupportForm() {
    const form = document.getElementById('supportForm');
    if (form) form.remove();
    addMessageToChat(currentLanguage === 'ar' ? "كيف يمكنني مساعدتك اليوم؟" : "How can I assist you today?", false);
    document.getElementById('sendButton').disabled = false;
}

function setLanguage(lang) {
    currentLanguage = lang;
    window.currentLanguage = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    document.getElementById("title").textContent = lang === "en" ? "University AI Assistant" : "المساعد الجامعي الذكي";
    document.getElementById('questionInput').placeholder = lang === 'ar' ? 'اكتب رسالتك...' : 'Type your message...';
    document.getElementById('sendButton').innerHTML = `<i class="fas fa-paper-plane"></i> ${lang === 'ar' ? 'إرسال' : 'Send'}`;
    document.querySelector('footer p').textContent = lang === 'ar' ? ' © 2025 المساعد الجامعي الذكي. جميع الحقوق محفوظة.' : ' © 2025 University AI Assistant. All rights reserved.';
    document.getElementById('signInButton').textContent = lang === 'ar' ? 'تسجيل الدخول' : 'Sign In';
    document.getElementById('loginTitle').textContent = lang === 'ar' ? 'تسجيل الدخول' : 'Sign In';
    document.getElementById('username').placeholder = lang === 'ar' ? 'اسم المستخدم' : 'User Name';
    document.getElementById('password').placeholder = lang === 'ar' ? 'كلمة المرور' : 'Password';
    document.getElementById('adminSignInbtn').textContent = lang === 'ar' ? 'تسجيل' : 'Sign In';
    document.getElementById('adminClosebtn').textContent = lang === 'ar' ? 'إلغاء' : 'Close';
    setWelcomeMessage(lang);
    if (typeof updateDashboardLanguage === 'function') {
        updateDashboardLanguage();
    } else {
        console.warn("updateDashboardLanguage not found; ensure dashboard.js is loaded");
    }
}

function setWelcomeMessage(lang) {
    const welcomeMessage = document.getElementById("welcome-message");
    if (lang === "en") {
        welcomeMessage.innerHTML = `
            Welcome to the virtual assistant for university admissions! How can I help you today?
          
           <i class="icon">📚 Admission and study at the university</i>  
            <i class="icon">🎫  Course registration</i> 
           <i class="icon">📝 Fees and payment</i> 
            <i class="icon">💡 Login issues</i> 
        `;
    } else {
        welcomeMessage.innerHTML = `
            أهلاً بك في المساعد الافتراضي للقبول في جامعة! كيف يمكنني مساعدتك اليوم؟
             
           <i class="icon"> 📚 القبول والدراسة بالجامعة       </i> 
            <i class="icon"> 🎫 تسجيل المقررات الدراسية</i> 
            <i class="icon">📝الرسوم والسداد</i> 
           <i class="icon">💡مشكلة في تسجيل الدخول</i> 
        `;
    }
}

function renderForm(content, type) {
    const chatContainer = document.getElementById('chatContainer');
    const formDiv = document.createElement('div');
    formDiv.className = 'chat-message bot-message';
    const alignmentClass = currentLanguage === 'ar' ? 'rtl' : 'ltr';
    const formId = `chatForm_${Date.now()}`;
    let html = `
        <div class="form-bubble ${alignmentClass}" style="${alignmentClass === 'rtl' ? 'margin-left: auto; margin-right: 0;' : 'margin-right: auto; margin-left: 0;'}">
            <p class="mb-4 ${alignmentClass === 'rtl' ? 'text-right' : 'text-left'}">${content.message}</p>
            <form id="${formId}" class="flex flex-col gap-4">
    `;

    content.options.forEach(option => {
        html += `
            <label class="form-group ${alignmentClass === 'rtl' ? 'text-right' : 'text-left'}">
                <input type="${type === 'checkbox' ? 'checkbox' : 'radio'}" name="option" value="${option.id}" class="${alignmentClass === 'rtl' ? 'ml-2' : 'mr-2'}">
                <span>${option.label}</span>
            </label>
        `;
    });

    html += `
            <div class="flex gap-2 mt-4 ${alignmentClass === 'rtl' ? 'justify-end' : 'justify-start'}">
                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">${content.submit}</button>
                <button type="button" onclick="cancelForm('${formId}')" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                    ${currentLanguage === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
            </div>
        </form>
        </div>
    `;

    formDiv.innerHTML = html;
    chatContainer.appendChild(formDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const form = document.getElementById(formId);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedOptions = Array.from(form.querySelectorAll('input[name="option"]:checked')).map(input => input.value);
        if (selectedOptions.length > 0) {
            await sendResponse(selectedOptions.join(','), content.state);
            formDiv.remove();
        } else {
            addMessageToChat(currentLanguage === 'ar' ? 'يرجى اختيار خيار واحد على الأقل.' : 'Please select at least one option.');
        }
    });
}

function cancelForm(formId) {
    const formDiv = document.getElementById(formId)?.closest('.chat-message');
    if (formDiv) {
        formDiv.remove();
        addMessageToChat(currentLanguage === 'ar' ? 'كيف يمكنني مساعدتك اليوم؟' : 'How can I assist you today?');
        document.getElementById('sendButton').disabled = false;
    }
}

async function sendResponse(selected, state) {
    console.log("Sending response:", selected, "with state:", state);
    const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/ask', {
        method: 'POST',
        headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`  // Include the fetched token
            },
        body: JSON.stringify({ text: selected, language: currentLanguage, session_id: sessionId })
    });
    const data = await response.json();
    console.log("Response from sendResponse:", JSON.stringify(data, null, 2));
    if (data.type === 'response') {
        addMessageToChat(data.content);
    } else if (data.type === 'checkbox' || data.type === 'radio') {
        renderForm(data.content, data.type);
    } else if (data.type === 'support_form') {
        renderSupportForm(data.content);
    } else if (data.type === 'agent_connected') {
        addMessageToChat(data.content.message);
        conversation_history[sessionId] = conversation_history[sessionId] || [];
        conversation_history[sessionId].push({"query": selected, "response": "Agent chat initiated", "state": {"step": "agent_chat", "room_id": data.content.room_id}});
    } else {
        console.warn("Unknown response type:", data.type);
        addMessageToChat(`نوع استجابة غير معروف: ${data.type}`);
    }
}

function connectWebSocket(sessionId) {
    ws = new WebSocket(`wss://asimabdulkhaleq-unismartagentapi.hf.space/ws/${sessionId}`);
    ws.onopen = () => console.log(`WebSocket connected for session: ${sessionId}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addMessageToChat(data.message || data, false);
    };
    ws.onclose = () => {
        console.log("WebSocket closed, retrying in 2 seconds...");
        setTimeout(() => connectWebSocket(sessionId), 2000);
    };
    ws.onerror = (error) => console.error("WebSocket error:", error);
}

async function askQuestion() {
    const question = document.getElementById('questionInput').value.trim();
    if (!question) return;

    console.log("Query:", question, "Lang:", currentLanguage, "Session:", sessionId);
    document.getElementById('sendButton').disabled = true;
    document.getElementById('typingIndicator').classList.remove('hidden');
    addMessageToChat(question, true);

    if (!ws || ws.readyState !== WebSocket.OPEN) connectWebSocket(sessionId);

    const lastState = conversation_history[sessionId]?.slice(-1)[0]?.state || {};
    if (ws.readyState === WebSocket.OPEN && lastState.step === "agent_chat") {
        const roomId = lastState.room_id;
        ws.send(JSON.stringify({ room_id: roomId, message: question, language: currentLanguage }));
        document.getElementById('questionInput').value = '';
        document.getElementById('sendButton').disabled = false;
        document.getElementById('typingIndicator').classList.add('hidden');
        return;
    }

    if (!apiToken) {
        addMessageToChat(currentLanguage === 'en' ? 'Error: API token not available' : 'خطأ: رمز API غير متوفر');
        document.getElementById('sendButton').disabled = false;
        document.getElementById('typingIndicator').classList.add('hidden');
        return;
    }

    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`  // Include the fetched token
            },
            body: JSON.stringify({ text: question, language: currentLanguage, session_id: sessionId })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
        }
        const data = await response.json();
        console.log("Response:", data);

        if (data.type === 'checkbox' || data.type === 'radio') {
            renderForm(data.content, data.type);
        } else if (data.type === 'support_form') {
            renderSupportForm(data.content);
        } else if (data.type === 'response') {
            addMessageToChat(data.content);
        } else if (data.type === 'agent_connected') {
            addMessageToChat(data.content.message);
            conversation_history[sessionId] = conversation_history[sessionId] || [];
            conversation_history[sessionId].push({
                "query": question,
                "response": "Agent chat initiated",
                "state": { "step": "agent_chat", "room_id": data.content.room_id }
            });
        } else {
            addMessageToChat(`Unknown response type: ${data.type}`);
        }
    } catch (error) {
        console.error('Fetch Error:', error.message, error.stack);
        const errorMsg = currentLanguage === 'en' ? `Error: ${error.message}` : `خطأ: ${error.message}`;
        addMessageToChat(errorMsg);
    } finally {
        document.getElementById('sendButton').disabled = false;
        document.getElementById('typingIndicator').classList.add('hidden');
        document.getElementById('questionInput').value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("chatbot.js loaded");
    fetchApiToken();  // Fetch token when the page loads
    initializeRecognition();
    initTextareaResize();
    connectWebSocket(sessionId);
    document.getElementById('recordButton').addEventListener('click', toggleRecording);
    document.getElementById('sendButton').addEventListener('click', askQuestion);
    document.getElementById('langArButton').addEventListener('click', () => {
        setLanguage('ar');
        document.getElementById('langArButton').classList.add('bg-blue-600', 'text-white');
        document.getElementById('langEnButton').classList.remove('bg-blue-600', 'text-white');
        document.getElementById('langEnButton').classList.add('bg-gray-200', 'text-gray-800');
    });
    document.getElementById('langEnButton').addEventListener('click', () => {
        setLanguage('en');
        document.getElementById('langEnButton').classList.add('bg-blue-600', 'text-white');
        document.getElementById('langArButton').classList.remove('bg-blue-600', 'text-white');
        document.getElementById('langArButton').classList.add('bg-gray-200', 'text-gray-800');
    });

    setLanguage('ar');
});

