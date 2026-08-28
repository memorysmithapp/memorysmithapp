---
title: Modelo de dados de Gestão (view)
aliases: [ER gestão, contratos financeiro view]
tags: [view, gestao, dados, dominio/gestao]
type: view
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-023 · Contract com renovação alerta custos e vínculo a itens|EV-1-023]]"
  - "[[EV-1-024 · Supplier Contact e Budget|EV-1-024]]"
  - "[[EV-1-025 · Document com dedup sha1 e Document_Item polimórfico|EV-1-025]]"
author: CAD Discovery
created: 2026-07-10
---

# Modelo de dados de Gestão (view)

Relações centrais de contratos, financeiro, fornecedores e documentos em torno de um ativo.

```mermaid
erDiagram
    SUPPLIER ||--o{ CONTACT_SUPPLIER : contatos
    CONTACT ||--o{ CONTACT_SUPPLIER : de
    CONTRACT ||--o{ CONTRACT_SUPPLIER : fornecedores
    SUPPLIER ||--o{ CONTRACT_SUPPLIER : em
    CONTRACT ||--o{ CONTRACT_ITEM : cobre
    CONTRACT ||--o{ CONTRACTCOST : custos
    ASSET ||--o{ CONTRACT_ITEM : coberto_por
    ASSET ||--o| INFOCOM : financeiro
    INFOCOM }o--o| BUDGET : orcamento
    INFOCOM }o--o| SUPPLIER : fornecedor
    CONTRACTCOST }o--o| BUDGET : orcamento
    ASSET ||--o{ DOCUMENT_ITEM : anexos
    DOCUMENT ||--o{ DOCUMENT_ITEM : em
    PROJECT ||--o{ PROJECTTASK : tarefas
    PROJECT ||--o{ PROJECTCOST : custos
```
