"""
=============================================================================
FINSCAN - SERVIDOR BACKEND FASTAPI
=============================================================================
Este módulo expõe as rotas RESTful para consulta de métricas financeiras 
e processamento de diálogos via IA (Gemini API) ou respostas pré-definidas.
Também serve os arquivos estáticos da interface web em http://127.0.0.1:8000/.
"""

import os
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from data_processor import process_metrics
from llm_service import generate_financial_response

# Inicialização da aplicação FastAPI
app = FastAPI(
    title="FinScan API",
    description="API RESTful do Assistente Virtual de Perfil Financeiro Pessoal (FinScan)",
    version="1.0.0"
)

# Configuração de suporte a CORS para consumo do frontend em diferentes origens
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelo Pydantic para validação das requisições de chat
class ChatRequest(BaseModel):
    message: str
    api_key: Optional[str] = None

# Modelo Pydantic para resposta padronizada do chat
class ChatResponse(BaseModel):
    response: str
    metrics_summary: dict

@app.get("/api/metrics", summary="Obter Métricas do Cliente", tags=["Indicadores"])
def get_metrics():
    """
    Lê a base de dados (perfil_cliente.json e transacoes.csv) e calcula em tempo real
    os indicadores financeiros e a divisão da Regra 50-30-20.
    """
    try:
        metrics = process_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar métricas financeiras: {str(e)}")

@app.post("/api/chat", response_model=ChatResponse, summary="Processar Diálogo do Chat", tags=["IA & Diálogo"])
def post_chat(chat_req: ChatRequest):
    """
    Recebe a mensagem do usuário e opcionalmente a chave da API do Gemini.
    Retorna o diagnóstico gerado pela LLM ou as respostas rápidas calibradas.
    """
    if not chat_req.message or not chat_req.message.strip():
        raise HTTPException(status_code=400, detail="A mensagem enviada não pode estar vazia.")
    
    try:
        metrics = process_metrics()
        bot_response = generate_financial_response(
            user_message=chat_req.message,
            metrics=metrics,
            user_api_key=chat_req.api_key
        )
        return ChatResponse(
            response=bot_response,
            metrics_summary=metrics.get("analise_50_30_20", {})
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na comunicação com o serviço LLM: {str(e)}")

# Montagem estática do frontend na raiz (http://127.0.0.1:8000/)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)