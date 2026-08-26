---
title: Banco de dados (database)
aliases: [Database, Banco de dados, Databases]
tags: [management, database, inventario]
type: component
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-d2-004 · Databases (databases.rst)|EV-2-d2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Banco de dados (database)

Um **Database** (banco de dados) é um objeto do módulo **Management** que lista os bancos **descobertos por inventário automático** ou **inseridos manualmente**. Complementa em profundidade o stub registrado em E3 ([[EV-2-c2-011 · Bancos de dados — stub (databases.rst)|EV-2-c2-011]]).

Bancos de dados podem ser **agrupados em instâncias** ([[Instância de banco de dados (database instance)]]): uma instância reúne todos os bancos obtidos do mesmo servidor (ex.: todos os bancos de uma instância MySQL).

Campos principais: nome, ativo (Sim/Não), instância associada, tamanho, backup e data do último backup — ver [[Campos do formulário de Banco de dados]].

> [!note] Relações
> Liga-se a documentos, base de conhecimento, tickets, problems, changes, [[Domínio (Internet domain)|domínios]] e [[Appliance (aplicação de negócio)|appliances]]; tem aba **Management** para dados financeiros/administrativos. Origem via [[Fluxo de inventário nativo]] ou entrada manual.

Insere-se na [[Gestão de Ativos e Configuração (SACM)]] e na capacidade [[Gestão de Bancos de Dados (capacidade)]].
