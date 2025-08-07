const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const axios = require('axios');
const dns = require('dns'); // Para verificar a conexão com a internet

require('dotenv').config();

const app = express();
const port = 3001;

// --- Configuração da API Key via Variável de Ambiente ---
const API_KEY = process.env.GEMINI_API_KEY;

// Inicializa o Gemini AI
const googleModel = new GoogleGenerativeAI(API_KEY).getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// --- Endpoint da API do Ollama ---
const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Função para verificar a conexão com a internet
async function isOnline() {
    return new Promise(resolve => {
        dns.lookup('google.com', err => {
            if (err && err.code === 'ENOTFOUND') {
                console.log("Sem conexão com a internet.");
                resolve(false);
            } else {
                console.log("Conectado à internet.");
                resolve(true);
            }
        });
    });
}

// Função para verificar se o Ollama está rodando
async function isOllamaRunning() {
    try {
        await axios.get('http://localhost:11434', { timeout: 1000 }); // Timeout curto para não travar
        console.log("Ollama está rodando.");
        return true;
    } catch (error) {
        console.log("Ollama não está rodando ou acessível.");
        return false;
    }
}

app.post('/analisar', async (req, res) => {
    console.log("--------------------------------------------------");
    console.log("Requisição recebida no backend Node.js.");
    try {
        const { prompt: promptText, image: base64ImageData, audio: base64AudioData, searchResults, isInitialAnalysis, llavaDescription } = req.body;

        if (!promptText && !base64ImageData && !base64AudioData) {
            return res.status(400).json({ error: 'Nenhuma mídia enviada' });
        }

        let responseText;
        let usedModel = "";

        const ollamaIsRunning = await isOllamaRunning();
        const isDeviceOnline = await isOnline();

        let finalPrompt = promptText;
        if (searchResults) {
            console.log("Resultados de busca recebidos. Enriquecendo o prompt.");
            finalPrompt = `Com base nos seguintes resultados de uma busca na web: "${searchResults}". Responda à pergunta original do usuário: "${promptText}". Sintetize a informação de forma clara e direta.`;
        }

        // --- Lógica de seleção de modelo e conteúdo para Ollama ---
        let ollamaModelToUse;
        let ollamaMessages;

        if (isInitialAnalysis && base64ImageData) {
            ollamaModelToUse = "llava";
            ollamaMessages = [{
                role: "user",
                content: finalPrompt || "Descreva detalhadamente o que você vê na imagem. Seja objetivo e conciso.",
                images: [base64ImageData]
            }];
            console.log("Análise inicial com LLaVA.");
        } else {
            ollamaModelToUse = "gemma:2b"; // Sempre gemma:2b para acompanhamento
            ollamaMessages = [{
                role: "user",
                content: `Contexto da Imagem: ${llavaDescription || '[Nenhuma descrição de imagem disponível]'}. Pergunta: ${finalPrompt || "Analise a mídia fornecida."}`,
                images: base64ImageData ? [base64ImageData] : []
            }];
            // Nota: O Ollama ainda não tem suporte nativo a áudio multimodal como o Gemini.
            // Se houver áudio, ele será tratado como parte do prompt de texto.
            // if (base64AudioData) {
            //     ollamaMessages[0].content = `Áudio: [dados de áudio]. ${ollamaMessages[0].content}`;
            // }
            console.log(`Requisição de acompanhamento com ${ollamaModelToUse}.`);
        }

        // --- Lógica de Prioridade: Google Gemini (Online) vs. Ollama (Offline/Fallback) ---
        if (isDeviceOnline && API_KEY) {
            // Tenta usar o Google Gemini como primário se online e com API Key
            try {
                console.log("Online. Tentando Google Gemini como primário...");
                return await tryGoogleGemini(req, res); // Usa a função auxiliar
            } catch (geminiPrimaryError) {
                console.error("Google Gemini primário falhou:", geminiPrimaryError.message);
                // Se o Google Gemini falhar, tenta Ollama como fallback (se estiver rodando)
                if (ollamaIsRunning) {
                    console.log("Google Gemini falhou. Tentando Ollama como fallback...");
                    // Reutiliza ollamaModelToUse e ollamaMessages já definidos
                    const ollamaPayload = {
                        model: ollamaModelToUse,
                        messages: ollamaMessages,
                        stream: false
                    };

                    try {
                        const ollamaResponse = await axios.post(OLLAMA_API_URL, ollamaPayload, { timeout: 180000 });
                        responseText = ollamaResponse.data.message.content;
                        usedModel = `Ollama (Fallback - ${ollamaModelToUse})`;
                    } catch (ollamaError) {
                        console.error(`Erro ao comunicar com o Ollama (fallback - ${ollamaModelToUse}):`, ollamaError.message);
                        throw new Error("Google Gemini falhou e Ollama fallback também falhou.");
                    }
                } else {
                    throw new Error("Google Gemini falhou e Ollama não está disponível.");
                }
            }
        } else if (ollamaIsRunning) {
            // Se offline OU sem API Key, mas Ollama está rodando, usa Ollama como primário
            console.log("Offline ou sem API Key. Usando Ollama como primário...");
            // Reutiliza ollamaModelToUse e ollamaMessages já definidos
            const ollamaPayload = {
                model: ollamaModelToUse,
                messages: ollamaMessages,
                stream: false
            };

            try {
                const ollamaResponse = await axios.post(OLLAMA_API_URL, ollamaPayload, { timeout: 180000 });
                responseText = ollamaResponse.data.message.content;
                usedModel = `Ollama (Primário - ${ollamaModelToUse})`;
            } catch (ollamaError) {
                console.error(`Erro ao comunicar com o Ollama (primário - ${ollamaModelToUse}):`, ollamaError.message);
                throw new Error("Ollama primário falhou e não há fallback disponível.");
            }
        } else {
            // Não há serviço de IA disponível
            throw new Error("Não há serviço de IA disponível. Verifique o Ollama ou sua conexão com a internet e API Key.");
        }

        const cleanText = responseText.replace(/(\n|#+|\*|_|\*\*)/g, " ").replace(/\s{2,}/g, " ").trim();
        console.log(`Resposta gerada usando: ${usedModel}`);
        res.json({ text: cleanText });

    } catch (error) {
        console.error("Erro geral no backend:", error);
        res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

// Função auxiliar para tentar a chamada ao Google Gemini
async function tryGoogleGemini(req, res) {
    const { prompt: promptText, image: base64ImageData, audio: base64AudioData, searchResults, isInitialAnalysis, llavaDescription } = req.body;
    let finalPrompt = promptText;
    if (searchResults) {
        finalPrompt = `Com base nos seguintes resultados de uma busca na web: "${searchResults}". Responda à pergunta original do usuário: "${promptText}". Sintetize a informação de forma clara e direta.`;
    }

    // Adiciona a descrição do LLaVA ao prompt do Gemini se disponível
    if (llavaDescription) {
        finalPrompt = `Contexto da Imagem: ${llavaDescription}. Pergunta: ${finalPrompt}`;
    }

    const geminiContents = { parts: [] };
    if (finalPrompt) geminiContents.parts.push({ text: finalPrompt });
    if (base64ImageData) geminiContents.parts.push({ inlineData: { data: base64ImageData, mimeType: 'image/jpeg' } });
    if (base64AudioData) geminiContents.parts.push({ inlineData: { data: base64AudioData, mimeType: 'audio/webm' } });

    try {
        const result = await googleModel.generateContent({ contents: [geminiContents] });
        const response = await result.response;
        const responseText = response.text();
        const cleanText = responseText.replace(/(\n|#+|\*|_|\*\*)/g, " ").replace(/\s{2,}/g, " ").trim();
        console.log("Resposta gerada usando: Google Gemini (Fallback)");
        return res.json({ text: cleanText });
    } catch (geminiError) {
        console.error("Erro ao comunicar com o Google Gemini (fallback):", geminiError.message);
        throw new Error("Fallback para Google Gemini também falhou.");
    }
}

app.listen(port, () => {
    console.log(`Servidor Node.js rodando em http://localhost:${port}`);
    console.log("Certifique-se de que o Ollama está rodando e o modelo 'gemma:2b' foi baixado com 'ollama pull gemma:2b' para usar o modo offline.");
});