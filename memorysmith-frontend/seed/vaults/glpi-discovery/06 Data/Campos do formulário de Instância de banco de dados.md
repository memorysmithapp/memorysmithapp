---
title: Campos do formulário de Instância de banco de dados
aliases: [Campos de Database instance, Database instance fields]
tags: [management, database-instance, campos, formulario, data]
type: entity
status: confirmed
source: "[[EV-2-d2-005 · Database instances (tabs-database_instances.rst)|EV-2-d2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Instância de banco de dados

Campos do formulário de uma [[Instância de banco de dados (database instance)]]:

| Campo | Valores/Tipo | Semântica |
|-------|--------------|-----------|
| **Item type** | tipo | Tipo do item sobre o qual o banco está instalado. |
| **Item** | referência | Item sobre o qual o banco está instalado. |
| **Name** | texto | Nome da instância. |
| **Status** | dropdown | Estado da instância. |
| **Associable to a ticket** | Yes/No | Se pode ser associada a um chamado. *(no doc consta "Yes / Note" — provável erro de digitação para "No")* |
| **Location** | dropdown | Localização. |
| **Database instance type** | dropdown | Tipo: MySQL, PostgreSQL, MariaDB etc. |
| **Technician in charge** | usuário | Técnico responsável. |
| **Manufacturer** | dropdown | Fabricante. |
| **User** | usuário | Usuário associado. |
| **Version** | texto | Versão. |
| **Comments** | texto | Comentários. |
| **Update source** | dropdown | Fonte de atualização. |
| **Active** | Yes/No | Se está ativa. |
| **Database instance category** | dropdown | Categoria da instância. |
| **Has backup** | Yes/No | Se possui backup. |
| **Last backup date** | data | Data do último backup. |
| **Port** | número | Porta de conexão. |
| **Path** | texto | Caminho. |

> [!tip] Campos editados manualmente ficam **travados (locked)** e não são sobrescritos pelo inventário automático — ver [[Aba Bloqueios (locks de inventário)]].
