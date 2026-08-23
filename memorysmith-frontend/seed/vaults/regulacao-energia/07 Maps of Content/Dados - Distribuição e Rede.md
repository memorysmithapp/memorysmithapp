---
title: Dados - Distribuição e Rede
aliases:
  - Distribuição e Rede
tags:
  - moc
  - dados-abertos
  - aneel
  - distribuicao
type: moc
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 4 conjuntos catalogados
---

> [!abstract]
> A infraestrutura em si: ativos georreferenciados, alimentadores, linhas, planos de expansão e sua execução.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]] | envio anual das distribuidoras | anual | — | ✅ |
| [[GCEM - Campos Elétricos e Magnéticos (ANEEL)]] | a partir de 2010 | ad hoc / conforme evento | — | — |
| [[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]] | a partir de 2023 | mensal | 1,4 M | ✅ |
| [[PDD - Plano de Desenvolvimento da Distribuição (ANEEL)]] | por ano de referência | anual | 5,5 k | ✅ |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Serviço Adequado (Distribuição)]] | [[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]], [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]] |
| [[Plano de Resultados]] | [[PDD - Plano de Desenvolvimento da Distribuição (ANEEL)]] |
| [[Compartilhamento de Infraestrutura de Postes]] | [[Base de Dados Geográfica da Distribuidora - BDGD (ANEEL)]] |
| [[Área de Elevada Complexidade ao Combate às Perdas]] | [[INDGER - Indicadores Gerenciais da Distribuição (ANEEL)]] |

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
