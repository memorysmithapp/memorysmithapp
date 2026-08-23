---
title: Substitutos autorizados (delegação de validação)
aliases: [authorized substitutes, substitutos, delegação de validação, delegatee]
tags: [user-settings, substitutes, validacao, aprovacao, delegacao, regra]
type: rule
status: confirmed
source: "[[EV-2-g2-017 · Substitutos autorizados (delegação de validação)|EV-2-g2-017]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

**Substitutos** são contas de usuário autorizadas a agir **em nome de outro usuário** para **validar ou recusar um ticket ou uma mudança**. Recurso introduzido no GLPI 10.1, configurado nas [[Configurações do usuário (User's settings)]].

Regras de uso:
- O usuário pode escolher **uma ou mais** contas para delegar a tarefa de validação.
- A delegação pode ser **limitada por intervalo de datas** (um ou ambos os limites).
- Reciprocamente, um usuário pode ser **delegado** de outros; nesse caso vê uma tabela de seus **delegantes** com o intervalo de datas de cada delegação.

Estende o mecanismo de [[Validação e aprovação (regra)]]: a delegação permite que a aprovação de [[Ticket]] e [[Change]] seja executada por um substituto autorizado. Campos em [[Campos da delegação de substitutos]].
