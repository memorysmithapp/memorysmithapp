---
title: Dados - Qualidade do Serviço
aliases:
  - Qualidade do Serviço
tags:
  - moc
  - dados-abertos
  - aneel
  - qualidade
type: moc
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 13 conjuntos catalogados
---

> [!abstract]
> Como o serviço de distribuição efetivamente chega ao consumidor: continuidade, tensão, tempo de atendimento, reclamações e satisfação.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[IndQual - Inadimplência (ANEEL)]] | a partir de 2012 | mensal | 1,1 M | ✅ |
| [[IndQual - Município (ANEEL)]] | a partir de 2001 | mensal | 43 k | ✅ |
| [[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]] | a partir de 2000 | mensal | 2,8 M | ✅ |
| [[Indicadores de Atendimento a Ocorrências Emergenciais (ANEEL)]] | a partir de 2000 | mensal | 1,2 M | ✅ |
| [[Indicadores de Conformidade do Nível de Tensão - DRP e DRC (ANEEL)]] | a partir de 2012 | mensal | 1,8 M | ✅ |
| [[Indicadores de Qualidade do Atendimento Telefônico (ANEEL)]] | a partir de jan/2014 | mensal | 5,9 k | ✅ |
| [[Interrupções de Energia Elétrica nas Redes de Distribuição (ANEEL)]] | a partir de 2017 | mensal | — | — |
| [[Ocorrências Emergenciais nas Redes de Distribuição (ANEEL)]] | a partir de 2017 | mensal | — | — |
| [[Ouvidoria Setorial ANEEL]] | a partir de 2014 | diária | 231 k / ano | ✅ |
| [[Qualidade do Atendimento Comercial (ANEEL)]] | a partir de 2011 | mensal | 1,5 M | ✅ |
| [[Reclamações no 1º e 2º Nível da Distribuidora (ANEEL)]] | a partir de jan/2010 | mensal | 6,0 M | ✅ |
| [[Segurança do Trabalho e das Instalações (ANEEL)]] | conforme envio das distribuidoras | mensal | 428 k | ✅ |
| [[Índice ANEEL de Satisfação do Consumidor - IASC (ANEEL)]] | a partir de 2006 | anual | 1,5 k | ✅ |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Serviço Adequado (Distribuição)]] | [[Indicadores Coletivos de Continuidade DEC e FEC (ANEEL)]], [[Indicadores de Conformidade do Nível de Tensão - DRP e DRC (ANEEL)]], [[Indicadores de Atendimento a Ocorrências Emergenciais (ANEEL)]], [[Ocorrências Emergenciais nas Redes de Distribuição (ANEEL)]], [[Interrupções de Energia Elétrica nas Redes de Distribuição (ANEEL)]], [[Qualidade do Atendimento Comercial (ANEEL)]], [[Indicadores de Qualidade do Atendimento Telefônico (ANEEL)]] |

# Derivados no `context-vault/`

Aqui entram os indicadores, séries e insights extraídos destes conjuntos. Enquanto nada foi medido, a lista fica vazia — e é assim que se vê, de relance, quanto do eixo já saiu do papel.

| Tipo | Nota | Última atualização |
|---|---|---|
| `indicator` | [[Transgressão dos Limites Coletivos de Continuidade]] | 2026-07-27 |
| `indicator` | [[Compensação por Violação dos Limites Individuais de Continuidade]] | 2026-07-27 |
| `indicator` | [[Suspensão Indevida do Fornecimento]] | 2026-07-27 |
| `series` | [[Evolução da Transgressão dos Limites de DEC e FEC (2020–2025)]] | 2026-07-27 |
| `series` | [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] | 2026-07-27 |
| `series` | [[Evolução da Inadimplência Definitiva das Distribuidoras (2020–2025)]] | 2026-07-27 |
| `insight` | [[A transgressão do limite coletivo não tem consequência financeira direta]] | 2026-07-27 |
| `insight` | [[A qualidade média melhora enquanto a compensação individual cresce]] | 2026-07-27 |
| `insight` | [[A transgressão crônica se concentra e não muda de dono]] | 2026-07-27 |
| `insight` | [[Inadimplência alta e continuidade ruim andam juntas]] | 2026-07-27 |

> [!success] Primeira rodada de medição — 2026-07-27
> Cinco conjuntos deste eixo saíram do papel: DEC/FEC coletivos (apurado, limite e compensação), INDGER comercial e IndQual inadimplência. Coleta em `data/scripts/coleta_qualidade_fiscalizacao.py`, processamento em `processa_qualidade_fiscalizacao.py`, recortes em `data/processed/`.

# Perguntas de Pesquisa

> [!question]
> - Por que o recurso de **atributos do conjunto** (nº de unidades consumidoras, extensão de rede) parou em 2014, se o catálogo declara cadência mensal? Sem ele não se reproduz o indicador global de continuidade da distribuidora.
> - O que extinguiu as rubricas de compensação por apuração **anual e trimestral** a partir de 2022?
> - Os conjuntos cronicamente em transgressão estão logo acima do limite (calibração) ou muito acima (serviço)?
> - Qual conjunto deste eixo deve ser o primeiro a ser efetivamente baixado e processado?
> - Que conceito do `knowledge-vault/` deste eixo ainda **não** tem dado que o meça?
> - Há divergência entre a cadência declarada e a data real da última publicação?

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC pai: [[Dados - Índice Geral]] · Inventário: [[Catálogo de Dados Abertos ANEEL]]
