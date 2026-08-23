---
title: Dados - Mercado e Consumo
aliases:
  - Mercado e Consumo
tags:
  - moc
  - dados-abertos
  - aneel
  - mercado
type: moc
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 3 conjuntos catalogados
---

> [!abstract]
> Quanto de energia circula, para quem e sob que contrato: mercado declarado pelas distribuidoras, balanço energético e estrutura societária dos agentes.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Composição Societária - Polímero (ANEEL)]] | a partir de dez/2020 | trimestral | — | — |
| [[SAMP - Balanço Energético (ANEEL)]] | a partir de 2003 | mensal | 545 k | ✅ |
| [[SAMP - Sistema de Acompanhamento de Informações de Mercado (ANEEL)]] | 2003 em diante | mensal | 644 k / ano | ✅ |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Área de Elevada Complexidade ao Combate às Perdas]] | [[SAMP - Balanço Energético (ANEEL)]] |

# Derivados no `context-vault/`

Aqui entram os indicadores, séries e insights extraídos destes conjuntos. Enquanto nada foi medido, a lista fica vazia — e é assim que se vê, de relance, quanto do eixo já saiu do papel.

| Tipo | Nota | Última atualização |
|---|---|---|
| _indicator_ | _nenhum_ | — |
| _series_ | _nenhuma_ | — |
| _insight_ | _nenhum_ | — |

# Perguntas de Pesquisa

> [!question]
> - Qual conjunto deste eixo deve ser o primeiro a ser efetivamente baixado e processado?
> - Que conceito do `knowledge-vault/` deste eixo ainda **não** tem dado que o meça?
> - Há divergência entre a cadência declarada e a data real da última publicação?

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC pai: [[Dados - Índice Geral]] · Inventário: [[Catálogo de Dados Abertos ANEEL]]
