# Fagulha em Campo: IA Multimodal Sem Barreiras

![Projeto Fagulha](<img width="1408" height="768" alt="Image_fx - 2025-08-07T111335 361" src="https://github.com/user-attachments/assets/13546e32-5180-4f04-997c-fade22a89440" />)

**Seu assistente de IA que funciona em qualquer lugar, com ou sem internet, projetado para levar conhecimento e acessibilidade a todos.**

Este projeto foi desenvolvido como parte do Desafio de Impacto Gemma 3n do Google, com a missão de criar uma solução de IA de impacto real, focada em acessibilidade e disponibilidade.

## 🔥 A Missão

O "Fagulha em Campo" ataca duas barreiras fundamentais:

1.  **A Barreira da Conectividade:** Oferece uma solução de IA funcional mesmo em áreas remotas e sem acesso à internet, crucial para setores como agronegócio, educação e resposta a crises.
2.  **A Barreira da Acessibilidade:** Atua como uma ferramenta de tecnologia assistiva, descrevendo o mundo visual para pessoas com deficiência visual, promovendo autonomia e inclusão.

## ✨ Funcionalidades Principais

*   **Análise Multimodal:** Processa entradas de texto, imagem e áudio.
*   **Arquitetura Híbrida (Online/Offline):**
    *   **Modo Online:** Utiliza o poder do `Google Gemini 1.5 Flash` para análises ricas e detalhadas quando há conexão com a internet.
    *   **Modo Offline:** Alterna automaticamente para modelos locais (`gemma:2b`, `llava`) via **Ollama** para garantir operação contínua sem internet.
*   **Interface Simples:** Uma interface web direta que permite acesso rápido à câmera e ao microfone para análises em tempo real.

## 🛠️ Tecnologias Utilizadas

*   **Backend:** Node.js, Express.js
*   **Frontend:** HTML5, CSS3, JavaScript
*   **IA Online:** Google Gemini API (`@google/generative-ai`)
*   **IA Offline:** Ollama (servindo modelos LLaVA e Gemma:2b)
*   **Comunicação:** Axios, CORS

## 🚀 Como Executar o Projeto

### Pré-requisitos

1.  **Node.js e npm:** [Instale aqui](https://nodejs.org/)
2.  **Ollama:** [Instale aqui](https://ollama.com/)
3.  **Modelos do Ollama:** Após instalar o Ollama, puxe os modelos necessários no seu terminal:
    ```bash
    ollama pull llava
    ollama pull gemma:2b
    ```

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/loombardo-99/fagulha-1.0---Copia.git
    ```

2.  **Navegue até o diretório do projeto:**
    ```bash
    cd "fagulha 1.0 - Copia"
    ```

3.  **Instale as dependências do Node.js:**
    ```bash
    npm install
    ```

4.  **Configure suas variáveis de ambiente:**
    *   Crie um arquivo chamado `.env` na raiz do projeto.
    *   Adicione sua chave da API do Google Gemini a ele:
      ```
      GEMINI_API_KEY=SUA_CHAVE_API_AQUI
      ```
    *   *Obs: Para o modo offline, a chave não é necessária.*

### Execução

1.  **Inicie o servidor backend:**
    ```bash
    node server.js
    ```
    O servidor estará rodando em `http://localhost:3001`.

2.  **Abra a interface:**
    *   Abra o arquivo `index.html` diretamente no seu navegador.
    *   Permita o acesso à câmera e ao microfone quando solicitado.

Agora você está pronto para usar o Fagulha em Campo!
