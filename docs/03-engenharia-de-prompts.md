# 🧠 Documento 03: Engenharia de Prompts

O **FinScan** utiliza um **System Prompt Executivo com Injeção Dinâmica de Contexto Financeiro** e descoberta automática de modelos Gemini.

---

## 1. Estrutura do System Prompt

```text
Você é o FinScan, um assistente virtual especialista e didático em análise de perfil financeiro pessoal.

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
```

---

## 2. Injeção Dinâmica de Contexto Financeiro

Antes de enviar a requisição à API do Gemini, o `llm_service.py` formata o estado orçamentário do cliente no padrão PT-BR:

```text
[CONTEXTO FINANCEIRO ATUAL DO CLIENTE (FORMATO PT-BR)]
- Nome: Luiz Moura
- Renda Mensal: R$ 5.000,00
- Reserva de Emergência: R$ 12.500,00 (3,0 meses de cobertura de despesas essenciais)
- Despesas Totais: R$ 4.900,00
- Gastos por Categoria: {'Moradia': 1800.0, 'Alimentação': 1150.0, 'Transporte': 500.0, 'Saúde': 700.0, 'Lazer': 750.0, 'Investimentos': 800.0}

[INDICADORES REGRA 50-30-20]
- Necessidades Essenciais: R$ 4.150,00 (83,0% da renda - Meta: 50% -> Status: Acima da Meta)
- Desejos / Estilo de Vida: R$ 750,00 (15,0% da renda - Meta: 30% -> Status: Dentro da Meta)
- Economias / Investimentos: R$ 1.600,00 (32,0% da renda - Meta: 20% -> Status: Acima da Meta)
```

---

## 3. Descoberta Dinâmica de Modelos Gemini

Para evitar erros de chave ou modelos depreciados (`HTTP 404: model not found`), a função `_call_gemini_api()` efetua uma requisição preliminar ao endpoint:
`GET https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}`

O algoritmo extrai a lista de modelos que suportam o método `generateContent` para aquela chave específica, priorizando variantes rápidas (`gemini-2.0-flash`, `gemini-1.5-flash`).