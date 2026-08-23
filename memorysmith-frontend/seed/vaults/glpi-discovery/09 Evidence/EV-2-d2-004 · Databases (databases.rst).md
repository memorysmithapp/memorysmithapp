---
title: EV-2-d2-004 · Databases (databases.rst)
aliases: [databases.rst, Databases]
tags: [evidence, management, database, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/management/databases.rst · Databases"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-004 · Databases (databases.rst)

Evidência da documentação sobre o objeto **Database** (banco de dados) no módulo Management. Complementa em profundidade o stub [[EV-2-c2-011 · Bancos de dados — stub (databases.rst)|EV-2-c2-011]] criado em E3.

> [!quote] databases.rst · introdução
> "Databases list databases discovered by automatic inventory and those entered manually." "Databases can be grouped into instances. An instance groups together all the databases retrieved from the same server (for example, all the databases in a MySQL instance). This data can also be retrieved by automatic inventory or entered manually."

> [!quote] databases.rst · "Database"
> Campos do formulário: **Name**; **Active** (Yes/No); **Database instance** (determina a instância de banco de dados); **Size (Mio)**; **Has backup** (Yes/No); **Last backup date** (data).

> [!quote] databases.rst · abas
> Abas: Management (informações financeiras/administrativas); Documents; Knowledge Base; Tickets; Problems; Changes (não é possível vincular change diretamente daqui, apenas criar uma nova); Notes; Domains (anexa domínios ao item); Appliances (aplicações de negócio vinculadas; podem ligar-se a outro objeto GLPI e a outro appliance); Historical e "all".

Capturas no doc: `images/databases-view.png` (visão geral), `images/databases-edit.png` (edição).

## Sustenta
- [[Banco de dados (database)]]
- [[Campos do formulário de Banco de dados]]
- [[Gestão de Bancos de Dados (capacidade)]]
