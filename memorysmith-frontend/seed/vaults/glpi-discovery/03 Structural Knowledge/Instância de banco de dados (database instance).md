---
title: Instância de banco de dados (database instance)
aliases: [Database instance, Instância de banco de dados, Bdd instance]
tags: [management, database-instance, inventario]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d2-005 · Database instances (tabs-database_instances.rst)|EV-2-d2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Instância de banco de dados (database instance)

Uma **Database instance** reúne **todos os bancos obtidos de um mesmo servidor** (ex.: todos os bancos de uma instância MySQL). Agrupa objetos [[Banco de dados (database)]] e é instalada sobre um item GLPI (definido por *Item type* + *Item*).

Pode ser criada por **inventário automático** ou **manualmente** ([[Fluxo de inventário nativo]]).

> [!tip] Campos travados (locks)
> Se um campo for modificado manualmente, ele é considerado **travado (locked)** e não será sobrescrito no próximo upload do inventário automático. Ver a aba **Locks** e a nota de E3 [[Aba Bloqueios (locks de inventário)]].

Campos incluem tipo da instância (MySQL, PostgreSQL, MariaDB...), versão, porta, caminho, categoria, backup etc. — ver [[Campos do formulário de Instância de banco de dados]].

## Abas
Impact Analysis, Databases (bancos da instância), Management, Contracts, Documents, Knowledge Base, Tickets, Problems, Changes, Links, Certificates, Locks, Notes, Domains, Appliances, Historical.

Relaciona-se com [[Módulo de Ativos (Assets)]] e [[Gestão de Ativos e Configuração (SACM)]].
