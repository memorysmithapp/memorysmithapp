---
title: Roteamento de tickets de e-mail (regras do coletor)
aliases: [Collector rules, Rules for assigning a ticket opened via a receiver]
tags: [coletor, receiver, regras, roteamento, entidade, email]
type: flow
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento|EV-2-f3-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Roteamento de tickets de e-mail (regras do coletor)

Quando um [[Receiver (coletor de e-mail) — visão de configuração|receiver]] importa um e-mail, o GLPI usa um mecanismo de **roteamento baseado no motor de regras** para criar o ticket na **entidade correta**. O menu só aparece em **Rules** se as notificações estiverem habilitadas.

**Critérios** disponíveis:
- Nome do receiver; requerente; domínio de e-mail (conhecido ou não).
- Cabeçalhos: `auto_submitted`, `from`, `in_reply_to`, `received`, `subject`, `to`, `X-Auto-Response-Suppress`, `X-priority`, `X-UCE-Status`; corpo do e-mail.
- Critérios de dados de usuário/entidade: **known email domain** (filtra spam); **user: group**; **user with profile**; **user with single profile** (entidade = entidade padrão do usuário); **user with the profile only once**.

**Ações**: recusa do ticket (com ou sem notificação ao emissor) ou importação numa entidade (manual, por TAG, por domínio de e-mail, ou por perfil do usuário).

> [!warning] O motor **para na primeira regra que casa**.

Exemplo de ordem sugerida (marcado como `todo` no doc): (1) recusar domínios desconhecidos; (2) recusar mailing lists; (3) afetar e-mails de usuários com um único perfil; (4) afetar a uma entidade por perfil específico.

Usa o [[Motor de Regras (engine)]] / [[Motor de Regras de Negócio (capacidade)]]; ver também [[Tipos de Regra]].

## Ver também
- [[Coletor de E-mail (MailCollector)]]
- [[Collectors de e-mail no Assistance]]
