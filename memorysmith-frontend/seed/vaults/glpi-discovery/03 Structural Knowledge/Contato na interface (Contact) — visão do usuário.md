---
title: Contato na interface (Contact) — visão do usuário
aliases: [Contact, Contato]
tags: [concept, management, contact, doc]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-004 · Contatos — definição, títulos e vCard|EV-2-d1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Contato na interface (Contact) — visão do usuário

Objeto do módulo Management que representa uma **pessoa externa** (não um usuário autenticado do GLPI), normalmente associada a contratos e fornecedores. Distingue-se de um usuário GLPI: usuários têm autenticação na aplicação; contatos, não.

Caracterizado por informações de identidade, **título**, telefone, e-mail, etc. Ver [[Campos do formulário de Contato]]. Definir uma lista de **tipos de contato** permite ordená-los por tipo. Um contato pode ser exportado em formato **vCard**.

> [!note]
> A lista de títulos possíveis para um contato é a mesma dos usuários.

Abas: **Suppliers**, Documents, External links, Notes, Historical, All.

> [!note] Ponte doc×código
> Corresponde a [[Fornecedores e Contatos]]. Relaciona-se a [[Distinção Fornecedor × Contato (regra)]] e, por contraste, a [[Usuários e Grupos]].
