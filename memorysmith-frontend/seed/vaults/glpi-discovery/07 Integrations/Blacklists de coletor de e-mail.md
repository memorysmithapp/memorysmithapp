---
title: Blacklists de coletor de e-mail
aliases: [Collector blacklists]
tags: [integracao, receiver, collector, blacklist, spam, email]
type: integration
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-008 · Receivers (coletores de e-mail), blacklists e regras de roteamento|EV-2-f3-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Blacklists de coletor de e-mail

Receivers ([[Receiver (coletor de e-mail) — visão de configuração]]) podem usar um mecanismo de **blacklist** com dois propósitos:

1. **Remover conteúdos recorrentes mas inúteis** dos e-mails importados — por exemplo, assinaturas de e-mail — antes de criar o ticket.
2. **Impedir a importação de e-mails de endereços específicos** — útil para prevenir spam ou para tratar aliases de e-mail.

Complementa o [[Roteamento de tickets de e-mail (regras do coletor)]] (que também pode recusar e-mails de domínios desconhecidos via critério *known email domain*).

## Ver também
- [[Coletor de E-mail (MailCollector)]]
