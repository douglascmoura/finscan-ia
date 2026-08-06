# 🗄️ Documento 02: Base de Dados e Dicionário

Este documento descreve a estrutura dos arquivos de dados locais utilizados pelo **FinScan** para consumo e agregação.

---

## 1. `datasets/perfil_cliente.json`
Armazena as informações cadastrais e orçamentárias do cliente.

| Campo | Tipo | Descrição | Exemplo no Sistema |
| :--- | :--- | :--- | :--- |
| `cliente_id` | String | Identificador único do cliente | `"CLI-89241"` |
| `nome` | String | Nome completo do cliente | `"Luiz Moura"` |
| `renda_mensal` | Float | Renda líquida mensal em R$ | `5000.00` |
| `reserva_atual` | Float | Saldo acumulado na reserva de emergência em R$ | `12500.00` |
| `objetivo_principal` | String | Meta principal declarada pelo cliente | `"Construção de Reserva de Emergência e Organização Orçamentária"` |

---

## 2. `datasets/transacoes.csv`
Extrato contendo as movimentações financeiras recentes do cliente.

| Coluna | Tipo | Descrição | Exemplo no Sistema |
| :--- | :--- | :--- | :--- |
| `data` | Date | Data da transação (`YYYY-MM-DD`) | `"2026-08-01"` |
| `categoria` | String | Categoria orçamentária do lançamento | `"Moradia"`, `"Alimentação"`, `"Lazer"` |
| `descricao` | String | Descrição detalhada da movimentação | `"Aluguel Residencial"`, `"Supermercado Mensal"` |
| `valor` | Float | Valor financeiro em R$ | `1800.00` |
| `tipo` | String | Classificação (`Despesa` ou `Investimento`) | `"Despesa"`, `"Investimento"` |

---

## 3. `datasets/regras_indicadores.json`
Parâmetros de configuração da **Regra 50-30-20** e mapeamento de categorias:

- **50% Necessidades Essenciais**: Moradia, Alimentação, Saúde, Transporte.
- **30% Desejos e Estilo de Vida**: Lazer, Restaurantes, Compras Pessoais.
- **20% Economias e Investimentos**: Aportes em Tesouro Selic, CDBs, reserva financeira.