---
title: EV-2-e1-009 · Aba Authorizations da ficha de usuário
aliases: [EV-2-e1-009]
tags: [evidence, usuarios, autorizacoes, perfis, entidades, recursivo, dinamico]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/users/tabs/authorizations.rst · Authorizations"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-e1-009 · Aba Authorizations da ficha de usuário

> [!quote] Authorizations (authorizations.rst)
> "Authorizations correspond to the rights and permissions assigned to users or groups to access different features or modules." Definem precisamente quem pode ver, criar, modificar ou excluir dados (tickets, ativos, orçamentos etc.). São geridas via **perfis** e garantem segurança, confidencialidade e distribuição de responsabilidades.
> Abreviações: **R = Recursive** — o perfil tem acesso a todas as entidades filhas anexadas; **D = Dynamic** — a autorização foi adicionada por uma **regra de autorização**; se a regra é modificada, a autorização também muda no próximo login do usuário.
> **Adicionar uma autorização**: selecionar a entidade, o perfil e a recursão. **Excluir uma autorização**: usar a ação massiva.

## Sustenta
- [[Atribuição de autorizações e grupos a um usuário (procedimento)]]
- [[Perfil de Usuário (conceito e composição)]]
