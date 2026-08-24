---
title: EV-2-d2-005 · Database instances (tabs-database_instances.rst)
aliases: [database_instances.rst, Database instances]
tags: [evidence, management, database-instance, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/management/tabs/database_instances.rst · Database instances"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-005 · Database instances (tabs-database_instances.rst)

Evidência da documentação sobre o objeto **Database instance** (instância de banco de dados).

> [!quote] database_instances.rst · introdução
> "A database instance groups together all the databases retrieved from the same server (for example, all the databases in a MySQL instance)." Nota: "These instances can be added using the automatic inventory or manually." Dica: "if you modify a field manually, it will be considered locked. This will prevent it from being modified the next time the automatic inventory is uploaded" (ver `locks`).

> [!quote] database_instances.rst · campos do formulário
> - **Item type**: define o tipo de item onde o banco está instalado.
> - **Item**: define o item onde o banco está instalado.
> - **Name**; **Status**; **Associable to a ticket** (Yes/No — no doc consta "Yes / Note", provável erro de digitação); **Location**; **Database instance type** (MySQL, PostgreSQL, MariaDB, etc.); **Technician in charge**; **Manufacturer**; **User**; **Version**; **Comments**; **Update source**; **Active** (Yes/No); **Database instance category**; **Has backup** (Yes/No); **Last backup date** (data); **Port**; **Path**.

> [!quote] database_instances.rst · abas
> Abas: Impact Analysis; Databases (lista os bancos presentes na instância); Management; Contracts; Documents; Knowledge Base; Tickets; Problems; Changes; Links; Certificates; **Locks** (impede modificação de campo no upload do inventário; permite travar/destravar campos); Notes; Domains; Appliances; Historical e "all".

Capturas no doc: `images/bdd_instances_view.png` (visão global), `images/bdd_instances_details_view.png` (detalhes).

## Sustenta
- [[Instância de banco de dados (database instance)]]
- [[Campos do formulário de Instância de banco de dados]]
- [[Aba Análise de Impacto (diagrama de dependências)]]
