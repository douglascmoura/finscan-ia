# 📚 Central de Documentação Técnica - FinScan

Bem-vindo à central de documentação técnica e científica do **FinScan** (Analista de Perfil Financeiro Pessoal alimentado por Inteligência Artificial).

Nesta pasta estão especificados o escopo do projeto, a persona didática do assistente, o dicionário de dados dos datasets, as técnicas de engenharia de prompts, a arquitetura de software e a matriz de avaliação qualitativa.

---

## 🧭 Índice de Navegação

1. 🎯 **[01 - Escopo e Persona](01-escopo-e-persona.md)**
   - Missão, visão e objetivos do FinScan.
   - Persona executiva e tom de voz (analítico, neutro, didático).
   - **Guardrails de segurança** e limites regulatórios CVM.

2. 🗄️ **[02 - Base de Dados](02-base-de-dados.md)**
   - Dicionário de dados dos arquivos em `datasets/` (`perfil_cliente.json`, `transacoes.csv`, `regras_indicadores.json`).
   - Mapeamento e métricas da Regra 50-30-20.

3. 🧠 **[03 - Engenharia de Prompts](03-engenharia-de-prompts.md)**
   - Estrutura detalhada do System Prompt.
   - Injeção de contexto RAG/Data-Aware.
   - Descoberta dinâmica de modelos Gemini (`/v1beta/models`).

4. 🏗️ **[04 - Arquitetura da Aplicação](04-arquitetura-aplicacao.md)**
   - Visão geral da arquitetura RESTful com FastAPI e Vanilla JS SPA.
   - Fluxograma de mensagens e sincronização ao vivo sem reload.

5. 📊 **[05 - Avaliação e Métricas](05-avaliacao-e-metricas.md)**
   - Matriz de avaliação qualitativa do diagnósticos da LLM.
   - Suíte de validação de Guardrails e precisão numérica PT-BR.