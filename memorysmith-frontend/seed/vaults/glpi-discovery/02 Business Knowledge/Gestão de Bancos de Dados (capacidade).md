---
title: Gestão de Bancos de Dados (capacidade)
aliases: [Databases management, Gestão de Bancos de Dados]
tags: [management, database, capacidade]
type: capability
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-d2-004 · Databases (databases.rst)|EV-2-d2-004]]"
  - "[[EV-2-d2-005 · Database instances (tabs-database_instances.rst)|EV-2-d2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Bancos de Dados (capacidade)

A gestão de **bancos de dados** no GLPI permite listar bancos **descobertos por inventário automático** e **inseridos manualmente**, e **agrupá-los em instâncias** por servidor.

- [[Banco de dados (database)]]: unidade de banco, com tamanho, backup e instância associada.
- [[Instância de banco de dados (database instance)]]: reúne todos os bancos de um mesmo servidor (ex.: MySQL, PostgreSQL, MariaDB), instalada sobre um item GLPI.

Origem dos dados via [[Fluxo de inventário nativo|inventário automático]] ou entrada manual; campos editados manualmente ficam travados ([[Aba Bloqueios (locks de inventário)]]). Integra a [[Gestão de Ativos e Configuração (SACM)]] e a [[Gestão Financeira de TI]].
