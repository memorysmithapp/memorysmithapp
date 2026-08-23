---
title: Campos do formulário de Banco de dados
aliases: [Campos de Database, Database fields]
tags: [management, database, campos, formulario, data]
type: entity
status: confirmed
source: "[[EV-2-d2-004 · Databases (databases.rst)|EV-2-d2-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Banco de dados

Campos do formulário de um [[Banco de dados (database)]]:

| Campo | Tipo/Valores | Semântica |
|-------|--------------|-----------|
| **Name** | texto | Nome do banco de dados. |
| **Active** | Yes/No | Se o banco está ativo. |
| **Database instance** | referência | Determina a [[Instância de banco de dados (database instance)|instância]] à qual o banco pertence. |
| **Size (Mio)** | número | Tamanho do banco em Mio (mebibytes). |
| **Has backup** | Yes/No | Se possui backup. |
| **Last backup date** | data | Data do último backup. |

Origem dos dados: [[Fluxo de inventário nativo|inventário automático]] ou entrada manual.
