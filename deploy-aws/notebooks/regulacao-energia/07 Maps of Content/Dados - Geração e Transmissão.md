---
title: Dados - Geração e Transmissão
aliases:
  - Geração e Transmissão
tags:
  - moc
  - dados-abertos
  - aneel
  - geracao
type: moc
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 17 conjuntos catalogados
---

> [!abstract]
> O parque gerador e a rede básica: cadastro de empreendimentos, expansão, outorgas, leilões e preços de referência.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Acréscimo Anual da Potência Instalada (ANEEL)]] | a partir de 1999 | anual | — | — |
| [[Agentes de Geração de Energia Elétrica (ANEEL)]] | cadastro corrente | mensal | — | — |
| [[Atos de Outorgas de Geração (ANEEL)]] | a partir de 2015 | mensal | — | — |
| [[BPR - Banco de Preços de Referência: Linha de Transmissão (ANEEL)]] | versões sucessivas do banco | mensal | — | — |
| [[BPR - Banco de Preços de Referência: Subestação (ANEEL)]] | versões sucessivas do banco | mensal | — | — |
| [[CFURH - Compensação Financeira pela Utilização de Recursos Hídricos (ANEEL)]] | a partir de 1993 | mensal | — | — |
| [[Capacidade Instalada por Unidade da Federação (ANEEL)]] | a partir de 2006 | trimestral | — | — |
| [[Desempenho das Concessionárias de Transmissão (ANEEL)]] | série histórica | ad hoc / conforme evento | — | — |
| [[Empreendimento Hidrelétrico em Estudo (ANEEL)]] | fases de pré-outorga | mensal | — | — |
| [[FSB - Fiscalização de Segurança de Barragens (ANEEL)]] | a partir de 2016 | mensal | — | — |
| [[Liberação para Operação Comercial de Empreendimentos de Geração (ANEEL)]] | 1997 em diante | ad hoc / conforme evento | — | — |
| [[Quantidade de Empreendimentos de Geração em Operação (ANEEL)]] | a partir de 2001 | trimestral | — | — |
| [[Quantidade de Usinas Termelétricas por Tipo (ANEEL)]] | desde 2012 | trimestral | — | — |
| [[RALIE - Acompanhamento da Expansão da Oferta de Geração (ANEEL)]] | a partir de 2021 | ad hoc / conforme evento | — | — |
| [[Resultado de Leilões de Geração e Transmissão (ANEEL)]] | série histórica | mensal | — | — |
| [[SIGA - Sistema de Informações de Geração (ANEEL)]] | cadastro corrente | diária | 25 k | ✅ |
| [[SIGET - Sistema de Gestão da Transmissão (ANEEL)]] | a partir de 2005 | diária | — | — |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

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
