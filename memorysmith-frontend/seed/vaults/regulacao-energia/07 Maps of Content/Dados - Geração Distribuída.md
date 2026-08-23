---
title: Dados - Geração Distribuída
aliases:
  - Geração Distribuída
tags:
  - moc
  - dados-abertos
  - aneel
  - geracao-distribuida
type: moc
status: growing
source: "[[Portal de Dados Abertos ANEEL (CKAN)]]"
author: Curadoria
created: 2026-07-27
updated: 2026-07-27
refresh_frequency: ad-hoc
data_source: https://dadosabertos.aneel.gov.br/dataset/
coverage: 2 conjuntos catalogados
---

> [!abstract]
> Adesão à micro e minigeração distribuída: quem conectou, onde, com que fonte e com que potência — e como as distribuidoras responderam aos pedidos de conexão.

# Conjuntos de dados

| Conjunto | Cobertura | Cadência | Volume | Schema |
|---|---|---|---|---|
| [[Atendimento a Pedidos de Conexão MMGD pós-Lei 14.300 (ANEEL)]] | 07/01/2022 a 07/01/2023, com atualizações posteriores | mensal | — | — |
| [[Relação de Empreendimentos de MMGD (ANEEL)]] | a partir de dez/2008 | diária | — | ✅ |

> [!info] Coluna **Schema**
> ✅ = campos e contagem de linhas conferidos no DataStore em 2026-07-27. — = ficha construída só a partir dos metadados do catálogo.

# Conceitos que estes dados medem

| Conceito | Conjunto de dados que o mede |
|---|---|
| [[Geração Distribuída (GD)]] | [[Relação de Empreendimentos de MMGD (ANEEL)]] |
| [[Microgeração Distribuída]] | [[Relação de Empreendimentos de MMGD (ANEEL)]] |
| [[Minigeração Distribuída]] | [[Relação de Empreendimentos de MMGD (ANEEL)]] |
| [[Sistema de Compensação de Energia Elétrica (SCEE)]] | [[Relação de Empreendimentos de MMGD (ANEEL)]] |
| [[Autoconsumo Remoto]] | _a construir_ |
| [[Geração Compartilhada]] | _a construir_ |
| [[Regra de Transição do Fio B]] | [[Atendimento a Pedidos de Conexão MMGD pós-Lei 14.300 (ANEEL)]] |
| [[Solicitação de Acesso para Micro e Minigeração Distribuída]] | [[Atendimento a Pedidos de Conexão MMGD pós-Lei 14.300 (ANEEL)]] |

# Derivados no `context-vault/`

Aqui entram os indicadores, séries e insights extraídos destes conjuntos. Enquanto nada foi medido, a lista fica vazia — e é assim que se vê, de relance, quanto do eixo já saiu do papel.

| Tipo | Nota | Última atualização |
|---|---|---|
| _indicator_ | _nenhum_ | — |
| _series_ | _nenhuma_ | — |
| _insight_ | _nenhum_ | — |

# Perguntas de Pesquisa

> [!question] Falta o conceito guarda-chuva
> `[[Geração Distribuída (GD)]]` é referenciado pelo README e por este MOC, mas **a nota não existe** no `knowledge-vault/`. Existem `[[Microgeração Distribuída]]` e `[[Minigeração Distribuída]]` separadamente. A Lei 14.300/2022 define as duas modalidades no art. 1º, mas não um conceito único de "geração distribuída" — escrever a nota guarda-chuva exige decidir se ela é síntese normativa ou construção do vault. É o link pendente mais central do eixo.

> [!question] Modalidades sem indicador
> `DscModalidadeHabilitado` na base de MMGD separa as quatro modalidades da Lei 14.300 — [[Autoconsumo Local]], [[Autoconsumo Remoto]], [[Geração Compartilhada]] e [[Empreendimento com Múltiplas Unidades Consumidoras]]. O dado existe e o conceito existe; falta o indicador que os liga. É a extração de menor esforço e maior retorno do eixo.

> [!question] Pedido virou conexão?
> O conjunto de pedidos de conexão cobre a janela 2022–2023; a base de MMGD cobre desde 2008 com atualização diária. Cruzar os dois deve mostrar a taxa de conversão de pedido em conexão — e onde ela travou.

> [!question] Operacionais
> - Qual conjunto deste eixo deve ser o primeiro a ser baixado e processado?
> - A cadência diária declarada pela base de MMGD se confirma no `metadata_modified`?

---

Fonte: [[Portal de Dados Abertos ANEEL (CKAN)]] · MOC pai: [[Dados - Índice Geral]] · Inventário: [[Catálogo de Dados Abertos ANEEL]]
