"""
=============================================================================
FINSCAN - SERVIÇO DE INTEGRAÇÃO COM LLM GEMINI & GUARDRAILS
=============================================================================
Este módulo é responsável por gerenciar os prompts do sistema, a comunicação 
dinâmica via REST com a API do Google Gemini (com descoberta dinâmica de modelos), 
a formatação de valores numéricos no padrão PT-BR e o enforcement dos Guardrails.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# System Prompt executivo com persona, formatação estrita e guardrails
SYSTEM_PROMPT = """Você é o FinScan, um assistente virtual especialista e didático em análise de perfil financeiro pessoal.

SUA PERSONA E SEU TOM DE VOZ:
- Analítico: Baseie-se exclusivamente nos números fornecidos no CONTEXTO.
- Neutro: Não faça julgamentos de valor sobre os hábitos de consumo.
- Didático: Explique os conceitos e a regra 50-30-20 de forma clara e acessível.

REGRAS DE FORMATAÇÃO DE NÚMEROS E MOEDA (OBRIGATÓRIO PT-BR):
- Use SEMPRE o padrão brasileiro de numeração: ponto (.) para milhares e vírgula (,) para decimais. Exemplo: R$ 5.000,00 (NUNCA R$ 5,000.00), 79,0% (NUNCA 79.0%), 3,2 meses (NUNCA 3.2 meses).

REGRAS DE ESTRUTURAÇÃO E MARKDOWN DAS RESPOSTAS:
- Use cabeçalhos (###) para seções principais.
- Para agrupar tópicos analíticos (como despesas essenciais ou cobertura de reserva), use subcabeçalhos (####) ou marcadores de ponto (•). NUNCA utilize numeração (1., 2.) para títulos de parágrafos descritivos.
- Use listas numeradas (1., 2., 3.) EXCLUSIVAMENTE para sequências ordenadas de metas ou passos de ação direta.
- Ao incluir avisos legais ou notas de restrição ao final da resposta, inicie a linha com '*Nota de segurança:*' para que a interface renderize o card visual de aviso.

GUARDRAILS RÍGIDOS DE SEGURANÇA:
1. NUNCA recomende ativos específicos (ações como PETR4/VALE3, FIIs, criptomoedas) nem produtos de bancos específicos.
2. NUNCA faça consultoria financeira regulamentada.
3. Se a pergunta for fora do assunto de finanças pessoais ou pedir indicação direta de investimentos, recuse com educação, explicando suas restrições e sugerindo consulta a um especialista certificado CVM.
"""

def fmt_brl(val: float) -> str:
    """Formata valor numérico para o padrão de moeda brasileiro (R$ 5.000,00)."""
    return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_num(val: float, decimals: int = 1) -> str:
    """Formata números decimais com vírgula (ex: 3,2 ou 79,0)."""
    if decimals == 1:
        return f"{val:.1f}".replace(".", ",")
    return f"{val:.2f}".replace(".", ",")

def _call_gemini_api(prompt: str, api_key: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Invoca a API do Gemini efetuando primeiro uma consulta HTTP GET a /v1beta/models 
    para descobrir dinamicamente quais modelos a chave API do usuário tem acesso.
    Garante resiliência e evita erros 404 de modelos incompatíveis.
    """
    last_error = None
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    json_bytes = json.dumps(payload).encode("utf-8")

    # 1. Busca dinâmica de modelos suportados para a chave informada
    dynamic_models = []
    try:
        models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        m_req = urllib.request.Request(models_url)
        with urllib.request.urlopen(m_req, timeout=12) as m_resp:
            if m_resp.status == 200:
                m_body = json.loads(m_resp.read().decode("utf-8"))
                for m in m_body.get("models", []):
                    m_name = m.get("name", "").replace("models/", "")
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        dynamic_models.append(m_name)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body)
            err_msg = err_json.get("error", {}).get("message", err_body)
        except Exception:
            err_msg = str(e)
        last_error = f"HTTP {e.code}: {err_msg}"
        if e.code in (400, 401, 403) and ("INVALID" in err_msg.upper() or "KEY" in err_msg.upper()):
            return None, last_error
    except Exception as ex:
        last_error = str(ex)

    # Ordenação prioritária de modelos rápidos (Flash / 2.0)
    if dynamic_models:
        flash_models = [m for m in dynamic_models if "flash" in m.lower()]
        other_models = [m for m in dynamic_models if "flash" not in m.lower()]
        models_to_try = flash_models + other_models
    else:
        models_to_try = [
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-2.0-flash-exp"
        ]

    # 2. Execução da requisição generateContent com fallback sequencial
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=json_bytes, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read().decode("utf-8"))
                    candidates = body.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join([p.get("text", "") for p in parts if "text" in p])
                        if text:
                            return text, None
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode("utf-8", errors="ignore")
                err_json = json.loads(err_body)
                err_msg = err_json.get("error", {}).get("message", err_body)
            except Exception:
                err_msg = str(e)
            last_error = f"HTTP {e.code}: {err_msg}"
            if e.code in (400, 401, 403) and ("INVALID" in err_msg.upper() or "KEY" in err_msg.upper()):
                break
        except Exception as ex:
            last_error = str(ex)

    return None, last_error

def generate_financial_response(user_message: str, metrics: dict, user_api_key: Optional[str] = None) -> str:
    """
    Gera a resposta do assistente financeiro. Se uma API Key for fornecida (via formulário ou .env), 
    chama o Gemini. Caso contrário, responde através das pré-definições calibradas.
    """
    api_key = (user_api_key and user_api_key.strip()) or os.getenv("GEMINI_API_KEY")

    perfil = metrics.get("perfil", {})
    nome_cliente = perfil.get("nome", "Cliente")
    a503020 = metrics.get("analise_50_30_20", {})
    nec = a503020.get("necessidades", {})
    des = a503020.get("desejos", {})
    eco = a503020.get("economias", {})

    renda = metrics.get('renda_mensal', 5000.0)
    reserva = metrics.get('reserva_atual', 12500.0)
    meses_res = metrics.get('meses_reserva', 3.2)
    despesas_totais = metrics.get('total_despesas', 4700.0)

    val_nec = nec.get('valor', 3950.0)
    perc_nec = nec.get('percentual', 79.0)
    meta_nec = nec.get('meta', 50.0)

    val_des = des.get('valor', 750.0)
    perc_des = des.get('percentual', 15.0)
    meta_des = des.get('meta', 30.0)

    val_eco = eco.get('valor', 1600.0)
    perc_eco = eco.get('percentual', 32.0)
    meta_eco = eco.get('meta', 20.0)

    user_lower = user_message.lower()

    # Verificação de padrões de gatilho para os botões rápidos e guardrails
    is_guardrail_test = any(p in user_lower for p in ["comprar", "ação", "acoes", "petr4", "vale3", "cripto", "bitcoin", "banco", "produto", "receita", "futebol", "carro", "filme", "lasanha", "jantar"])
    is_reduzir_nec = any(p in user_lower for p in ["reduzir", "necessidades", "cortar", "essenciais", "diminuir gastos"])
    is_avaliar_res = any(p in user_lower for p in ["reserva", "emergência", "emergencia", "suficiente", "cobertura"])

    contexto_str = f"""
[CONTEXTO FINANCEIRO ATUAL DO CLIENTE (FORMATO PT-BR)]
- Nome: {nome_cliente}
- Renda Mensal: R$ {fmt_brl(renda)}
- Reserva de Emergência: R$ {fmt_brl(reserva)} ({fmt_num(meses_res)} meses de cobertura de despesas essenciais)
- Despesas Totais: R$ {fmt_brl(despesas_totais)}
- Gastos por Categoria: {metrics.get('gastos_por_categoria', {})}

[INDICADORES REGRA 50-30-20]
- Necessidades Essenciais: R$ {fmt_brl(val_nec)} ({fmt_num(perc_nec)}% da renda - Meta: {fmt_num(meta_nec, 0)}% -> Status: {nec.get('status')})
- Desejos / Estilo de Vida: R$ {fmt_brl(val_des)} ({fmt_num(perc_des)}% da renda - Meta: {fmt_num(meta_des, 0)}% -> Status: {des.get('status')})
- Economias / Investimentos: R$ {fmt_brl(val_eco)} ({fmt_num(perc_eco)}% da renda - Meta: {fmt_num(meta_eco, 0)}% -> Status: {eco.get('status')})
"""

    prompt_final = f"{SYSTEM_PROMPT}\n\n{contexto_str}\n\n[PERGUNTA DO USUÁRIO]\n{user_message}"

    # Execução via API Gemini quando houver chave válida disponível
    if api_key and api_key != "SUA_CHAVE_API_GEMINI_AQUI":
        generated_text, err_detail = _call_gemini_api(prompt_final, api_key)
        if generated_text:
            return generated_text
        else:
            return f"🛑 **Erro ao comunicar com a API do Gemini** ({err_detail}). Verifique se sua API Key foi copiada corretamente do Google AI Studio."

    # Respostas pré-definidas para navegação didática sem necessidade de API Key
    if is_guardrail_test:
        if any(p in user_lower for p in ["receita", "futebol", "carro", "filme", "lasanha", "jantar"]):
            return (f"ℹ️ **Fora do Escopo**: Olá, **{nome_cliente}**! Sou o FinScan, especialista unicamente na análise e diagnóstico "
                    "do seu perfil financeiro pessoal. Como posso ajudar a organizar seu orçamento hoje?")
        return (f"⚠️ **Guardrail Ativado**: Olá, **{nome_cliente}**! Como assistente virtual de perfil financeiro didático, "
                "eu **não forneço recomendações de ativos específicos** (como ações, FIIs ou criptomoedas) nem produtos bancários. "
                "Minha função é ajudá-lo a diagnosticar sua divisão orçamentária 50-30-20 e organizar suas finanças. "
                "Para indicações diretas de carteira, consulte um profissional credenciado CVM.\n\n"
                "*Nota de segurança: Não realizo recomendações de investimentos de acordo com as normas CVM.*")

    if is_reduzir_nec:
        return (f"📉 **Diagnóstico para Redução de Necessidades Essenciais ({nome_cliente})**:\n\n"
                f"Suas despesas essenciais somam **R$ {fmt_brl(val_nec)}**, representando **{fmt_num(perc_nec)}%** da sua renda (a meta ideal é 50,0%).\n\n"
                f"#### Detalhamento das Necessidades:\n"
                f"• **Moradia**: R$ {fmt_brl(metrics.get('gastos_por_categoria', {}).get('Moradia', 1800.0))}\n"
                f"• **Alimentação**: R$ {fmt_brl(metrics.get('gastos_por_categoria', {}).get('Alimentação', 1150.0))}\n"
                f"• **Transporte**: R$ {fmt_brl(metrics.get('gastos_por_categoria', {}).get('Transporte', 500.0))}\n"
                f"• **Saúde**: R$ {fmt_brl(metrics.get('gastos_por_categoria', {}).get('Saúde', 500.0))}\n\n"
                f"💡 **Recomendação FinScan**: Avalie otimizações na categoria de Alimentação (Supermercado / feira) e renegociação de contas de consumo. Reduzir R$ 1.450,00 nessa categoria alinharia seu orçamento à meta de 50,0%.\n\n"
                f"*Nota de segurança: Esta análise tem caráter meramente educativo e não substitui uma consultoria financeira individualizada.*")

    if is_avaliar_res:
        return (f"🛡️ **Avaliação da Reserva de Emergência ({nome_cliente})**:\n\n"
                f"Sua reserva atual de **R$ {fmt_brl(reserva)}** cobre aproximadamente **{fmt_num(meses_res)} meses** das suas despesas essenciais mensais (R$ {fmt_brl(val_nec)}).\n\n"
                f"#### Parâmetros Financeiros:\n"
                f"• **Mínimo Recomendado (3 meses)**: R$ {fmt_brl(val_nec * 3)}\n"
                f"• **Ideal para Estabilidade (6 meses)**: R$ {fmt_brl(val_nec * 6)}\n\n"
                f"💡 **Diagnóstico FinScan**: Sua reserva está em um patamar seguro básico ({fmt_num(meses_res)} meses). Recomendamos continuar aportando até atingir pelo menos 6 meses de necessidades (R$ {fmt_brl(val_nec * 6)}).\n\n"
                f"*Nota de segurança: Para a escolha dos instrumentos de investimento com liquidez diária adequados para a sua reserva, consulte um especialista credenciado pela CVM.*")

    # Resposta informativa padrão orientando o cadastro da chave API
    return ("🔑 **Chave API do Gemini Necessária**: Para enviar perguntas personalizadas ao FinScan, "
            "insira sua chave API do Google AI Studio no campo localizado no cabeçalho superior.\n\n"
            "💡 *Sem a chave, você pode consultar livremente as 3 análises pré-definidas disponíveis nos botões rápidos!*")