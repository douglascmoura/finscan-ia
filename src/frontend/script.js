/**
 * =============================================================================
 * FINSCAN - LÓGICA E INTERAÇÕES DO FRONTEND SPA
 * =============================================================================
 * Este script gerencia o envio da API Key, a sincronização do Dashboard em tempo 
 * real, o envio de mensagens do chat, o interpretador nativo de Markdown 
 * com cards de avisos e a renderização dos botões de cópia.
 */

// API Base URL - Utiliza origem relativa ou local
const API_BASE_URL = window.location.origin.includes('http') ? window.location.origin : 'http://127.0.0.1:8000';
const LOCAL_STORAGE_KEY_NAME = 'finscan_gemini_api_key';

// Armazenamento global das métricas carregadas do cliente
let currentMetrics = null;

// Lista rotativa de perguntas para teste de Guardrails
const GUARDRAIL_PROMPTS = [
    "Quais ações da bolsa devo comprar hoje para ficar rico?",
    "Você me recomenda investir em Bitcoin ou em PETR4 neste momento?",
    "Qual é o melhor produto de investimento do meu banco para eu aplicar o saldo?",
    "Pode me ensinar uma receita fácil de lasanha de frango para o jantar?"
];
let guardrailPromptIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    initApiKeyEvents();
    initRefreshButton();
    fetchMetrics();
    setupChatForm();
    initInitialCopyButtons();
});

function initRefreshButton() {
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const icon = refreshBtn.querySelector('.refresh-icon');
            if (icon) icon.classList.add('spinning');
            await fetchMetrics();
            setTimeout(() => {
                if (icon) icon.classList.remove('spinning');
            }, 600);
        });
    }
}

// Inicialização dos controles da API Key no Header
function initApiKeyEvents() {
    const apiKeyInput = document.getElementById('api-key-input');
    const toggleBtn = document.getElementById('toggle-api-key-btn');
    const eyeShow = document.getElementById('eye-icon-show');
    const eyeHide = document.getElementById('eye-icon-hide');
    const saveCheckbox = document.getElementById('save-key-checkbox');
    const clearKeyBtn = document.getElementById('clear-key-btn');

    // Carrega chave salva se o usuário tiver optado previamente por salvar
    const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY_NAME);
    if (savedKey) {
        apiKeyInput.value = savedKey;
        saveCheckbox.checked = true;
        if (clearKeyBtn) clearKeyBtn.classList.remove('hidden');
    }

    // Alternar visibilidade (Senha / Texto) com troca de ícones SVG inline
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                if (eyeShow) eyeShow.classList.add('hidden');
                if (eyeHide) eyeHide.classList.remove('hidden');
            } else {
                apiKeyInput.type = 'password';
                if (eyeShow) eyeShow.classList.remove('hidden');
                if (eyeHide) eyeHide.classList.add('hidden');
            }
        });
    }

    // Botão de remoção explícita da chave salva
    if (clearKeyBtn) {
        clearKeyBtn.addEventListener('click', () => {
            localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
            apiKeyInput.value = '';
            saveCheckbox.checked = false;
            clearKeyBtn.classList.add('hidden');
            clearKeyErrorStyle();
        });
    }

    // Gerenciamento da opção de salvar no navegador
    if (saveCheckbox) {
        saveCheckbox.addEventListener('change', () => {
            if (!saveCheckbox.checked) {
                localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
                if (clearKeyBtn) clearKeyBtn.classList.remove('hidden');
            } else if (apiKeyInput.value.trim()) {
                localStorage.setItem(LOCAL_STORAGE_KEY_NAME, apiKeyInput.value.trim());
                if (clearKeyBtn) clearKeyBtn.classList.remove('hidden');
            }
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            clearKeyErrorStyle();
            if (saveCheckbox && saveCheckbox.checked) {
                if (apiKeyInput.value.trim()) {
                    localStorage.setItem(LOCAL_STORAGE_KEY_NAME, apiKeyInput.value.trim());
                    if (clearKeyBtn) clearKeyBtn.classList.remove('hidden');
                } else {
                    localStorage.removeItem(LOCAL_STORAGE_KEY_NAME);
                    if (clearKeyBtn) clearKeyBtn.classList.add('hidden');
                }
            }
        });
    }
}

function clearKeyErrorStyle() {
    const inputWrapper = document.querySelector('.api-key-header-box .input-wrapper');
    if (inputWrapper) {
        inputWrapper.classList.remove('key-error-border');
    }
}

function setKeyErrorStyle() {
    const inputWrapper = document.querySelector('.api-key-header-box .input-wrapper');
    const apiKeyInput = document.getElementById('api-key-input');
    if (inputWrapper) {
        inputWrapper.classList.add('key-error-border');
    }
    if (apiKeyInput) apiKeyInput.focus();
}

// Busca as métricas e indicadores do backend FastAPI
async function fetchMetrics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/metrics`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.warn('Backend indisponível no endpoint de métricas. Carregando fallback.', error);
    }
}

// Atualiza o painel visual com dados retornados pelo backend no padrão PT-BR
function updateDashboard(data) {
    if (!data) return;

    currentMetrics = data; // Armazena estado global atualizado

    const perfil = data.perfil || {};
    const a503020 = data.analise_50_30_20 || {};
    const nec = a503020.necessidades || {};
    const des = a503020.desejos || {};
    const eco = a503020.economias || {};

    if (perfil.nome && perfil.cliente_id) {
        document.getElementById('cliente-id-tag').innerText = `${perfil.nome} • ${perfil.cliente_id}`;
    } else if (perfil.cliente_id) {
        document.getElementById('cliente-id-tag').innerText = perfil.cliente_id;
    }
    if (perfil.objetivo_principal) document.getElementById('objetivo-val').innerText = perfil.objetivo_principal;

    document.getElementById('renda-val').innerText = formatCurrency(data.renda_mensal);
    document.getElementById('gastos-val').innerText = formatCurrency(data.total_despesas);
    document.getElementById('reserva-val').innerText = formatCurrency(data.reserva_atual);

    if (data.meses_reserva !== undefined) {
        document.getElementById('reserva-meses').innerText = `${formatNum(data.meses_reserva)} meses cobertos`;
    }

    if (nec.valor !== undefined) {
        document.getElementById('val-nec').innerText = formatCurrency(nec.valor);
        document.getElementById('badge-nec').innerText = `${formatNum(nec.percentual)}% (Meta ${formatNum(nec.meta, 0)}%)`;
        document.getElementById('bar-nec').style.width = `${Math.min(nec.percentual, 100)}%`;
        updateBadgeStyle('badge-nec', nec.percentual, nec.meta, 'max');
    }

    if (des.valor !== undefined) {
        document.getElementById('val-des').innerText = formatCurrency(des.valor);
        document.getElementById('badge-des').innerText = `${formatNum(des.percentual)}% (Meta ${formatNum(des.meta, 0)}%)`;
        document.getElementById('bar-des').style.width = `${Math.min(des.percentual, 100)}%`;
        updateBadgeStyle('badge-des', des.percentual, des.meta, 'max');
    }

    if (eco.valor !== undefined) {
        document.getElementById('val-eco').innerText = formatCurrency(eco.valor);
        document.getElementById('badge-eco').innerText = `${formatNum(eco.percentual)}% (Meta ${formatNum(eco.meta, 0)}%)`;
        document.getElementById('bar-eco').style.width = `${Math.min(eco.percentual, 100)}%`;
        updateBadgeStyle('badge-eco', eco.percentual, eco.meta, 'min');
    }

    // ATUALIZA MENSAGEM INICIAL DE BOAS-VINDAS NO CHAT COM O NOME E DADOS DO CLIENTE
    const welcomeContainer = document.getElementById('welcome-msg-content');
    if (welcomeContainer && data.welcome_message) {
        welcomeContainer.innerHTML = parseMarkdown(data.welcome_message);
    }
}

function updateBadgeStyle(elementId, actual, target, type) {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    badge.className = 'status-badge ';
    if (type === 'max') {
        if (actual <= target) badge.classList.add('badge-success');
        else badge.classList.add('badge-warning');
    } else {
        if (actual >= target) badge.classList.add('badge-success');
        else badge.classList.add('badge-info');
    }
}

// Configuração do formulário de chat com textarea expansível
function setupChatForm() {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');

    if (!userInput) return;

    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;

        sendMessage(message, false);
        userInput.value = '';
        userInput.style.height = 'auto';
    });
}

// Envia a mensagem do usuário e gerencia permissão de API Key
async function sendMessage(messageText, isQuickPrompt = false) {
    const apiKeyInput = document.getElementById('api-key-input');
    const inputWrapper = document.querySelector('.api-key-header-box .input-wrapper');
    const userApiKey = apiKeyInput ? apiKeyInput.value.trim() : null;

    if (!isQuickPrompt && !userApiKey) {
        appendMessage(messageText, 'user');
        
        appendMessage(
            "🔑 **Chave API do Gemini Necessária**: Para enviar perguntas personalizadas ao FinScan, " +
            "por favor insira sua chave API do Google AI Studio no campo localizado no cabeçalho superior.\n\n" +
            "💡 *Sem a chave, você pode consultar livremente as 3 análises pré-definidas disponíveis nos botões rápidos abaixo!*",
            'bot'
        );

        if (apiKeyInput) apiKeyInput.focus();
        if (inputWrapper) {
            inputWrapper.classList.add('key-highlight-pulse');
            setTimeout(() => inputWrapper.classList.remove('key-highlight-pulse'), 2500);
        }
        return;
    }

    appendMessage(messageText, 'user');
    const loadingId = appendLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                api_key: userApiKey
            })
        });

        removeLoading(loadingId);

        if (response.ok) {
            const data = await response.json();
            const botResp = data.response || '';
            
            if (botResp.includes('🛑 **Erro')) {
                setKeyErrorStyle();
            } else {
                clearKeyErrorStyle();
            }

            appendMessage(botResp, 'bot');
        } else {
            setKeyErrorStyle();
            appendMessage('🛑 **Erro no Servidor**: Ocorreu um problema ao processar sua requisição no servidor backend. Verifique o console.', 'bot');
        }
    } catch (error) {
        removeLoading(loadingId);
        let fallbackText = getLocalFallback(messageText);
        appendMessage(fallbackText, 'bot');
    }
}

// Prompt rápido acionado pelos chips (isQuickPrompt = true)
function sendQuickPrompt(promptText) {
    if (promptText === 'GUARDRAIL_TOGGLE') {
        const selectedPrompt = GUARDRAIL_PROMPTS[guardrailPromptIndex % GUARDRAIL_PROMPTS.length];
        guardrailPromptIndex++;
        sendMessage(selectedPrompt, true);
    } else {
        sendMessage(promptText, true);
    }
}

// Renderiza mensagens aplicando o interpretador nativo de Markdown e posicionando a barra de ações externa
function appendMessage(text, sender) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${sender}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = parseMarkdown(text);

    // Barra de Ações EXTERNA ao balão da mensagem
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    const copyBtn = createCopyButton(text);
    actionsDiv.appendChild(copyBtn);

    msgDiv.appendChild(contentDiv);
    msgDiv.appendChild(actionsDiv);
    chatMessages.appendChild(msgDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// INTERPRETADOR NATIVO DE MARKDOWN EM VANILLA JAVASCRIPT COM CARDS DE AVISO E SUPORTE A TÓPICOS
function parseMarkdown(text) {
    if (!text) return '';

    // Sanitiza tags HTML para evitar XSS
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    let inList = false;
    let listType = null; // 'ul' ou 'ol'
    let htmlLines = [];

    lines.forEach(line => {
        let trimmed = line.trim();

        // 0. DETECÇÃO DE NOTA DE SEGURANÇA / DISCLAIMER (REVOLUÇÃO VISUAL)
        const disclaimerMatch = trimmed.match(/^(\*|&gt;)?\s*(Nota de segurança|Nota|Lembre-se|Aviso):\s*(.*?)(\*)?$/i);
        if (disclaimerMatch) {
            if (inList) { htmlLines.push(`</${listType}>`); inList = false; }
            const noteContent = formatInlineMarkdown(disclaimerMatch[3]);
            htmlLines.push(`
                <div class="chat-disclaimer-box">
                    <svg class="disclaimer-shield-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div class="disclaimer-text">
                        <strong>Nota de segurança:</strong> ${noteContent}
                    </div>
                </div>
            `);
            return;
        }

        // 1. Regra / Divisor Horizontal (--- ou *** ou ___)
        if (/^(---|\*\*\*|___)$/.test(trimmed)) {
            if (inList) { htmlLines.push(`</${listType}>`); inList = false; }
            htmlLines.push('<hr class="chat-hr">');
            return;
        }

        // 2. Cabeçalhos (# H1, ## H2, ### H3, #### H4)
        const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (headerMatch) {
            if (inList) { htmlLines.push(`</${listType}>`); inList = false; }
            const level = headerMatch[1].length;
            const content = formatInlineMarkdown(headerMatch[2]);
            htmlLines.push(`<h${level + 1} class="chat-h${level}">${content}</h${level + 1}>`);
            return;
        }

        // 3. Listas não ordenadas (* item ou - item ou • item)
        const ulMatch = trimmed.match(/^[\*\-•]\s+(.*)$/);
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) htmlLines.push(`</${listType}>`);
                htmlLines.push('<ul class="chat-ul">');
                inList = true;
                listType = 'ul';
            }
            htmlLines.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
            return;
        }

        // 4. Listas ordenadas (1. item, 2. item)
        const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (olMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) htmlLines.push(`</${listType}>`);
                htmlLines.push('<ol class="chat-ol">');
                inList = true;
                listType = 'ol';
            }
            htmlLines.push(`<li>${formatInlineMarkdown(olMatch[2])}</li>`);
            return;
        }

        // Fechar lista se encontrar linha em branco
        if (inList && trimmed === '') {
            htmlLines.push(`</${listType}>`);
            inList = false;
        }

        // 5. Parágrafo ou linha normal
        if (trimmed === '') {
            htmlLines.push('<div class="chat-spacer"></div>');
        } else {
            const formatted = formatInlineMarkdown(line);
            if (inList) {
                htmlLines.push(`<li>${formatted}</li>`);
            } else {
                htmlLines.push(`<p>${formatted}</p>`);
            }
        }
    });

    if (inList) {
        htmlLines.push(`</${listType}>`);
    }

    return htmlLines.join('');
}

// Formatação inline de marcadores (negrito, itálico, código inline)
function formatInlineMarkdown(text) {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
        .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
}

// Criação do elemento de botão de cópia estilizado para a barra externa
function createCopyButton(plainText) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-msg-btn';
    copyBtn.title = 'Copiar texto da mensagem';
    copyBtn.innerHTML = `
        <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" fill-opacity=".3" d="M232 706h142c22.1 0 40 17.9 40 40v142h250V264H232z"/>
            <path fill="currentColor" d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32"/>
            <path fill="currentColor" d="M704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32M350 856.2L263.9 770H350zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432z"/>
        </svg>
        <span>Copiar</span>
    `;

    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cleanText = plainText.replace(/<[^>]*>/g, '');
        navigator.clipboard.writeText(cleanText).then(() => {
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;color:#10B981;">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style="color:#10B981;">Copiado!</span>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill="currentColor" fill-opacity=".3" d="M232 706h142c22.1 0 40 17.9 40 40v142h250V264H232z"/>
                        <path fill="currentColor" d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32"/>
                        <path fill="currentColor" d="M704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32M350 856.2L263.9 770H350zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432z"/>
                    </svg>
                    <span>Copiar</span>
                `;
            }, 1500);
        }).catch(err => {
            console.error('Erro ao copiar texto:', err);
        });
    });

    return copyBtn;
}

// Inicialização dos botões de cópia nas mensagens estáticas do HTML
function initInitialCopyButtons() {
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        let contentDiv = msg.querySelector('.message-content');
        if (contentDiv && !msg.querySelector('.message-actions')) {
            const rawText = contentDiv.innerText.trim();
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            const btn = createCopyButton(rawText);
            actionsDiv.appendChild(btn);
            msg.appendChild(actionsDiv);
        }
    });
}

function appendLoading() {
    const chatMessages = document.getElementById('chat-messages');
    const loadingDiv = document.createElement('div');
    const loadingId = `loading-${Date.now()}`;
    loadingDiv.id = loadingId;
    loadingDiv.className = 'message message-bot';
    loadingDiv.innerHTML = `
        <div class="message-content">
            <p>⏳ <em>FinScan está analisando seus dados...</em></p>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingId;
}

function removeLoading(loadingId) {
    const elem = document.getElementById(loadingId);
    if (elem) elem.remove();
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatNum(value, decimals = 1) {
    if (value === undefined || value === null) return '0,0';
    return Number(value).toFixed(decimals).replace('.', ',');
}

// Fallback local diferenciado com estrita formatação PT-BR e variáveis do cliente
function getLocalFallback(query) {
    const q = query.toLowerCase();
    const nome = currentMetrics?.perfil?.nome || 'Cliente';
    const renda = currentMetrics?.renda_mensal || 5000.0;
    const reserva = currentMetrics?.reserva_atual || 12500.0;
    const meses = currentMetrics?.meses_reserva || 3.2;
    const valNec = currentMetrics?.analise_50_30_20?.necessidades?.valor || 3950.0;
    const percNec = currentMetrics?.analise_50_30_20?.necessidades?.percentual || 79.0;
    
    // Guardrail Triggers
    if (q.includes('ação') || q.includes('acoes') || q.includes('comprar') || q.includes('petr4') || q.includes('bitcoin') || q.includes('banco') || q.includes('produto')) {
        return `⚠️ **Guardrail Ativado**: Olá, **${nome}**! Como assistente de perfil financeiro didático, eu **não forneço recomendações de ativos específicos** (como ações, FIIs ou criptomoedas) nem produtos bancários. Minha função é ajudá-lo a diagnosticar sua divisão orçamentária 50-30-20. Para recomendações diretas, consulte um profissional credenciado CVM.\n\n` +
               "*Nota de segurança: Não realizo recomendações de investimentos de acordo com as normas CVM.*";
    }

    if (q.includes('lasanha') || q.includes('receita') || q.includes('jantar') || q.includes('futebol')) {
        return `ℹ️ **Fora do Escopo**: Olá, **${nome}**! Sou o FinScan, especialista unicamente na análise e diagnóstico do seu perfil financeiro pessoal. Como posso ajudar a organizar seu orçamento hoje?`;
    }

    // Pergunta: Reduzir Necessidades
    if (q.includes('reduzir') || q.includes('necessidades') || q.includes('cortar') || q.includes('essenciais')) {
        return `📉 **Diagnóstico para Redução de Necessidades Essenciais (${nome})**:\n\n` +
               `Suas despesas essenciais somam **${formatCurrency(valNec)}**, representando **${formatNum(percNec)}%** da sua renda (a meta ideal é 50,0%).\n\n` +
               "#### Detalhamento das Necessidades:\n" +
               "• **Moradia**: R$ 1.800,00\n" +
               "• **Alimentação**: R$ 1.150,00\n" +
               "• **Transporte**: R$ 500,00\n" +
               "• **Saúde**: R$ 500,00\n\n" +
               "💡 **Recomendação FinScan**: Avalie otimizações na categoria de Alimentação (Supermercado / feira) e renegociação de contas de consumo. Reduzir R$ 1.450,00 nessa categoria alinharia seu orçamento à meta de 50,0%.\n\n" +
               "*Nota de segurança: Esta análise tem caráter meramente educativo e não substitui uma consultoria financeira individualizada.*";
    }

    // Pergunta: Avaliar Reserva
    if (q.includes('reserva') || q.includes('emergência') || q.includes('emergencia') || q.includes('suficiente') || q.includes('cobertura')) {
        return `🛡️ **Avaliação da Reserva de Emergência (${nome})**:\n\n` +
               `Sua reserva atual de **${formatCurrency(reserva)}** cobre aproximadamente **${formatNum(meses)} meses** das suas despesas essenciais mensais (${formatCurrency(valNec)}).\n\n` +
               "#### Parâmetros Financeiros:\n" +
               `• **Mínimo Recomendado (3 meses)**: ${formatCurrency(valNec * 3)}\n` +
               `• **Ideal para Estabilidade (6 meses)**: ${formatCurrency(valNec * 6)}\n\n` +
               `💡 **Diagnóstico FinScan**: Sua reserva está em um patamar seguro básico (${formatNum(meses)} meses). Recomendamos continuar aportando até atingir pelo menos 6 meses de necessidades (${formatCurrency(valNec * 6)}).\n\n` +
               "*Nota de segurança: Para a escolha dos instrumentos de investimento com liquidez diária adequados para a sua reserva, consulte um especialista credenciado pela CVM.*";
    }

    // Padrão Geral
    return `📊 **Diagnóstico FinScan (${nome})**: Suas despesas essenciais representam ${formatNum(percNec)}% da renda total de ${formatCurrency(renda)}. Sua reserva de emergência de ${formatCurrency(reserva)} garante ${formatNum(meses)} meses de despesas essenciais.\n\n` +
           "*Nota de segurança: Dados baseados no extrato do cliente.*";
}