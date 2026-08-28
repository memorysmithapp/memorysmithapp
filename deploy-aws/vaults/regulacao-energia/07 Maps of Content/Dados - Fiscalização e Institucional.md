---
title: Dados - Fiscalização e Institucional
aliases:
  - Fiscalização e Institucional
tags:
  - moc
  - dados-abertos
  - aneel
  - fiscalizacao
type: moc
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 13 conjuntos catalogados
---

> [!abstract]
> A ação da agência: fiscalização, penalidades, arrecadação, participação social e programas setoriais de P&D e eficiência.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Audiências e Consultas Públicas (ANEEL)]] | a partir de 2013 | trimestral | — | — |
| [[Auto de Infração (ANEEL)]] | a partir de mai/2018 | mensal | — | — |
| [[Cadastro de Agentes do Setor Elétrico (ANEEL)]] | cadastro corrente | mensal | 9,9 k | ✅ |
| [[Pautas e Atas das Reuniões Públicas da Diretoria (ANEEL)]] | a partir de set/2017 | semanal | — | — |
| [[Projetos de Eficiência Energética (ANEEL)]] | a partir de 1999 | mensal | — | — |
| [[Projetos de P&D em Energia Elétrica (ANEEL)]] | 2008 em diante | mensal | — | — |
| [[Reuniões Públicas da Diretoria (ANEEL)]] | set/2017 em diante | mensal | — | — |
| [[SIGEC - Sistema de Gestão de Créditos (ANEEL)]] | a partir de 1998 | diária | — | — |
| [[SLC - Sistema de Licitações e Contratos da ANEEL]] | até 2020 | ad hoc / conforme evento | — | — |
| [[TFSEE - Taxa de Fiscalização de Serviços de Energia Elétrica (ANEEL)]] | série corrente | diária | — | — |
| [[TIPE - Termos de Intimação das Penas dos Editais (ANEEL)]] | série corrente | mensal | — | — |
| [[Termo de Intimação - TI (ANEEL)]] | a partir de mai/2018 | mensal | — | — |
| [[Termo de Notificação (ANEEL)]] | a partir de mai/2018 | mensal | — | — |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Caducidade da Concessão de Distribuição]] | [[Termo de Intimação - TI (ANEEL)]] |
| [[Garantia de Fiel Cumprimento]] | [[TIPE - Termos de Intimação das Penas dos Editais (ANEEL)]] |
| [[Rede Nacional dos Consumidores de Energia Elétrica (Renacon)]] | [[Audiências e Consultas Públicas (ANEEL)]] |

# Derivados no `context-vault/`

Aqui entram os indicadores, séries e insights extraídos destes conjuntos. Enquanto nada foi medido, a lista fica vazia — e é assim que se vê, de relance, quanto do eixo já saiu do papel.

| Tipo | Nota | Última atualização |
|---|---|---|
| `indicator` | [[Autos de Infração e Multas Aplicados a Distribuidoras]] | 2026-07-27 |
| `series` | [[Evolução da Compensação por Continuidade e das Multas (2020–2025)]] | 2026-07-27 |
| `insight` | [[A transgressão do limite coletivo não tem consequência financeira direta]] | 2026-07-27 |

> [!success] Primeira rodada de medição — 2026-07-27
> Auto de Infração e Termo de Notificação foram coletados e processados. Achado estrutural da base: dos 1.580 autos, **apenas 141 atingem distribuidoras** na janela 2020–2025 — o conjunto é dominado por fiscalização de geração, e o pico de 711 autos em 2024 é integralmente eólica e fotovoltaica.

# Perguntas de Pesquisa

> [!question]
> - A REN 846/2019, que fixa o enquadramento das penalidades, **não está em `docs/`** — sem ela não se verifica a que grupo de multa corresponde cada natureza de fiscalização.
> - Os 23 autos por continuidade se concentram nas distribuidoras de maior excedente de horas, ou são distribuídos ao acaso? É o teste que separa fiscalização seletiva de tolerância.
> - Qual conjunto deste eixo deve ser o primeiro a ser efetivamente baixado e processado?
> - Que conceito do `knowledge-vault/` deste eixo ainda **não** tem dado que o meça?
> - Há divergência entre a cadência declarada e a data real da última publicação?

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC pai: [[Dados - Índice Geral]] · Inventário: [[Catálogo de Dados Abertos ANEEL]]
