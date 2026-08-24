---
title: Dados - Tarifas e Encargos
aliases:
  - Tarifas e Encargos
tags:
  - moc
  - dados-abertos
  - aneel
  - tarifas
type: moc
maturity: growing
reviewed: false
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 8 conjuntos catalogados
---

> [!abstract]
> Formação do preço da energia: tarifas homologadas, seus componentes, bandeiras, subsídios e quem paga por eles.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Bandeiras Tarifárias (ANEEL)]] | a partir de jan/2015 | mensal | 14 k | ✅ |
| [[Beneficiários da CDE (ANEEL)]] | a partir de 2017 | anual | — | — |
| [[CTR - Curvas de Carga de Consumidores e Redes Tipo (ANEEL)]] | a partir de 2012 | ad hoc / conforme evento | 2,8 M | ✅ |
| [[Componentes Tarifárias (ANEEL)]] | 2010 em diante | semanal | 621 k / ano | ✅ |
| [[Custeio dos Benefícios Tarifários pela CDE (ANEEL)]] | por ano de referência | anual | 373 | ✅ |
| [[SCS - Sistema de Controle de Subvenções e Programas Sociais (ANEEL)]] | a partir de 2011 | mensal | 75 k | ✅ |
| [[Subsídios Tarifários (ANEEL)]] | a partir de fev/2013 | mensal | 227 k | ✅ |
| [[Tarifas de Aplicação das Distribuidoras (ANEEL)]] | 2010 em diante | semanal | 322 k | ✅ |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Conta de Desenvolvimento Energético (CDE)]] | [[Componentes Tarifárias (ANEEL)]], [[Subsídios Tarifários (ANEEL)]], [[Beneficiários da CDE (ANEEL)]], [[Custeio dos Benefícios Tarifários pela CDE (ANEEL)]], [[SCS - Sistema de Controle de Subvenções e Programas Sociais (ANEEL)]] |
| [[Separação Tarifária e Contábil]] | [[Tarifas de Aplicação das Distribuidoras (ANEEL)]] |
| [[Regra de Transição do Fio B]] | _a construir_ |

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
