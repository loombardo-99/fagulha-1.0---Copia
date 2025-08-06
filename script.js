console.log("script.js loaded - FINAL UI & CONTEXT PASSING VERSION");

document.addEventListener('DOMContentLoaded', () => {
    const cameraView = document.getElementById('camera-view');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loadingFuse = document.getElementById('loading-fuse');
    const chatControls = document.getElementById('chat-controls');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const flipCameraBtn = document.getElementById('flip-camera-btn');
    const micBtn = document.getElementById('mic-btn');

    let lastCapturedImage = null;
    let currentFacingMode = 'environment';
    let lastLlavaDescription = null; // Armazena a descrição do LLaVA

    // --- Função para verificar o status da conexão ---
    function updateOnlineStatus() {
        if (!navigator.onLine) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = "Offline (Apenas Texto/Áudio)";
            addMessage("Você está offline. A análise de imagem não está disponível. Use texto ou áudio.", 'ai');
        } else {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = "Analisar";
        }
    }

    // --- Função para adicionar mensagens ao chat ---
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = text;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // A resposta da IA sempre será falada
        if (sender === 'ai') {
            speak(text);
        }
    }

    // --- Função para Text-to-Speech ---
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.cancel(); // Cancela falas anteriores
            window.speechSynthesis.speak(utterance);
        } else {
            console.warn("Speech Synthesis não suportado neste navegador.");
        }
    }

    // --- Acessar a Câmera ---
    async function startCamera(facingMode = 'environment') {
        console.log(`Iniciando câmera: ${facingMode}`);
        if (cameraView.srcObject) {
            cameraView.srcObject.getTracks().forEach(track => track.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
            cameraView.srcObject = stream;
            currentFacingMode = facingMode;
            analyzeBtn.disabled = false;
        } catch (err) {
            console.error("Erro ao acessar a câmera: ", err);
            addMessage("Erro ao acessar a câmera. Por favor, autorize o acesso.", 'ai');
            analyzeBtn.disabled = true;
        }
    }

    // --- Função para capturar o frame da câmera ---
    function captureFrame() {
        console.log("Capturando frame...");
        const canvas = document.createElement('canvas');
        canvas.width = cameraView.videoWidth;
        canvas.height = cameraView.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }

    // --- Função para enviar requisição ao backend ---
    async function sendAnalysisRequest(payload) {
        window.speechSynthesis.cancel(); // Interrompe a fala atual
        loadingFuse.classList.remove('hidden');
        analyzeBtn.disabled = true;
        sendBtn.disabled = true;
        micBtn.disabled = true;

        try {
            const API_URL = 'http://localhost:3001/analisar';
            console.log("Enviando requisição com payload:", Object.keys(payload));

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || 'Erro desconhecido no servidor');
            }

            const data = await response.json();
            addMessage(data.text, 'ai');

            // Se for a análise inicial, armazena a descrição do LLaVA
            if (payload.isInitialAnalysis) {
                lastLlavaDescription = data.text;
            }

        } catch (err) {
            console.error("Erro durante a análise: ", err);
            addMessage(`Erro: ${err.message}`, 'ai');
        } finally {
            loadingFuse.classList.add('hidden');
            analyzeBtn.disabled = false;
            sendBtn.disabled = false;
            micBtn.disabled = false;
        }
    }

    // --- Lógica de Análise Inicial ---
    analyzeBtn.addEventListener('click', async () => {
        console.log("Botão Analisar clicado.");
        chatHistory.innerHTML = '';
        lastCapturedImage = captureFrame();
        if (!lastCapturedImage) return;

        const initialPrompt = `Analise a imagem e, de forma concisa, diga o que você vê. Em seguida, pergunte ao usuário o que ele gostaria de saber sobre o que foi identificado.`;
        
        await sendAnalysisRequest({ 
            prompt: initialPrompt, 
            image: lastCapturedImage, 
            isInitialAnalysis: true 
        });
        chatControls.classList.remove('hidden');
    });

    // --- Lógica de Envio de Mensagem (Texto) ---
    sendBtn.addEventListener('click', async () => {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;

        addMessage(userMessage, 'user');
        const payload = {
            prompt: `Com base na descrição da imagem: "${lastLlavaDescription || '[Nenhuma descrição disponível]'}" e na nossa conversa, o usuário disse: "${userMessage}". Aja como um especialista e responda diretamente. Não sugira pesquisas externas.`,
            image: lastCapturedImage,
            llavaDescription: lastLlavaDescription // Envia a descrição do LLaVA para o backend
        };
        
        await sendAnalysisRequest(payload);
        userInput.value = '';
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });

    // --- Lógica do Botão Virar Câmera ---
    flipCameraBtn.addEventListener('click', () => {
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera(currentFacingMode);
    });

    // --- Lógica de Gravação de Áudio (Speech-to-Text) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('active')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        recognition.onstart = () => {
            micBtn.classList.add('active');
            userInput.placeholder = "Ouvindo...";
            console.log("Reconhecimento de fala iniciado.");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            console.log("Texto reconhecido:", transcript);
            sendBtn.click();
        };

        recognition.onerror = (event) => {
            console.error("Erro no reconhecimento de fala:", event.error);
            userInput.placeholder = "Erro ao ouvir.";
            micBtn.classList.remove('active');
        };

        recognition.onend = () => {
            micBtn.classList.remove('active');
            userInput.placeholder = "Escreva aqui...";
            console.log("Reconhecimento de fala finalizado.");
        };

    } else {
        console.warn("Speech Recognition não suportado neste navegador.");
        micBtn.style.display = 'none';
    }

    // Inicia a câmera ao carregar a página
    startCamera();

    // Verifica o status da conexão ao carregar e em mudanças
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});