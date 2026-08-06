"""
=============================================================================
FINSCAN - PROCESSADOR DE DADOS FINANCEIROS
=============================================================================
Este módulo é responsável por realizar a leitura e consolidação dos datasets 
locais (`perfil_cliente.json`, `transacoes.csv` e `regras_indicadores.json`).
Calcula os indicadores da Regra 50-30-20, o nível de cobertura da Reserva de Emergência 
e gera a mensagem de boas-vindas dinâmica interpolada com os dados do cliente.
"""

import os
import json
import pandas as pd

# Mapeamento do diretório base dos datasets
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")

def load_perfil() -> dict:
    """Carrega as informações cadastrais e orçamentárias do cliente."""
    path = os.path.join(DATASETS_DIR, "perfil_cliente.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_regras() -> dict:
    """Carrega os parâmetros da Regra 50-30-20 e categorizações do sistema."""
    path = os.path.join(DATASETS_DIR, "regras_indicadores.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_transacoes() -> pd.DataFrame:
    """Lê a planilha CSV de movimentações financeiras recentes."""
    path = os.path.join(DATASETS_DIR, "transacoes.csv")
    return pd.read_csv(path)

def process_metrics() -> dict:
    """
    Consolida as métricas do cliente e retorna o dicionário estruturado para 
    alimentar os cartões visuais do frontend e o contexto da IA.
    """
    perfil = load_perfil()
    regras = load_regras()
    df = load_transacoes()

    renda = float(perfil.get("renda_mensal", 5000.0))
    reserva = float(perfil.get("reserva_atual", 0.0))

    # Consolidação dos totais por categoria e por tipo de lançamento
    gastos_categoria = df.groupby("categoria")["valor"].sum().to_dict()
    total_despesas = float(df[df["tipo"] == "Despesa"]["valor"].sum())
    total_investimentos = float(df[df["tipo"] == "Investimento"]["valor"].sum())

    # Agrupamento das categorias na arquitetura 50-30-20
    mapa = regras.get("mapeamento_categorias", {})
    cat_necessidades = mapa.get("necessidades", [])
    cat_desejos = mapa.get("desejos", [])
    cat_economias = mapa.get("economias_investimentos", [])

    val_necessidades = sum(gastos_categoria.get(c, 0.0) for c in cat_necessidades)
    val_desejos = sum(gastos_categoria.get(c, 0.0) for c in cat_desejos)
    val_economias = sum(gastos_categoria.get(c, 0.0) for c in cat_economias) + total_investimentos

    # Cálculo dos percentuais em relação à Renda Mensal
    perc_necessidades = round((val_necessidades / renda) * 100, 2) if renda > 0 else 0.0
    perc_desejos = round((val_desejos / renda) * 100, 2) if renda > 0 else 0.0
    perc_economias = round((val_economias / renda) * 100, 2) if renda > 0 else 0.0

    meta_nec = regras["metas_percentuais"]["necessidades"]
    meta_des = regras["metas_percentuais"]["desejos"]
    meta_eco = regras["metas_percentuais"]["economias_investimentos"]

    # Meses de cobertura da reserva de emergência baseados no custo essencial mensal
    meses_reserva = round(reserva / val_necessidades, 1) if val_necessidades > 0 else 0.0

    # Construção da mensagem inicial de boas-vindas com dados dinâmicos do cliente
    nome_cliente = perfil.get("nome", "Cliente")
    perc_nec_str = f"{perc_necessidades:.1f}".replace(".", ",")
    welcome_message = (
        f"Olá, **{nome_cliente}**! Sou o **FinScan**, seu assistente de diagnóstico financeiro.\n\n"
        f"Analisei suas transações recentes. Suas despesas essenciais representam **{perc_nec_str}%** do orçamento total.\n\n"
        f"💡 Insira sua chave API do Gemini no cabeçalho ou selecione uma opção rápida abaixo!"
    )

    return {
        "perfil": perfil,
        "welcome_message": welcome_message,
        "renda_mensal": renda,
        "reserva_atual": reserva,
        "meses_reserva": meses_reserva,
        "total_despesas": total_despesas,
        "total_investimentos": total_investimentos,
        "gastos_por_categoria": gastos_categoria,
        "analise_50_30_20": {
            "necessidades": {
                "valor": val_necessidades,
                "percentual": perc_necessidades,
                "meta": meta_nec,
                "status": "Dentro da Meta" if perc_necessidades <= meta_nec else "Acima da Meta"
            },
            "desejos": {
                "valor": val_desejos,
                "percentual": perc_desejos,
                "meta": meta_des,
                "status": "Dentro da Meta" if perc_desejos <= meta_des else "Acima da Meta"
            },
            "economias": {
                "valor": val_economias,
                "percentual": perc_economias,
                "meta": meta_eco,
                "status": "Abaixo da Meta" if perc_economias < meta_eco else "Dentro da Meta"
            }
        }
    }