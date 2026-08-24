---
title: Coletor de E-mail (MailCollector)
aliases: [MailCollector, e-mail para chamado, IMAP]
tags: [integration, email, dominio/integracoes]
type: integration
maturity: evergreen
reviewed: false
source: "[[EV-1-036 · MailCollector e-mail para chamado|EV-1-036]]"
author: CAD Discovery
created: 2026-07-10
---

# Coletor de E-mail (MailCollector)

Integração de entrada que transforma **e-mails em chamados**. Monitora caixas **IMAP** e, a
cada execução (cron):

1. Lê mensagens novas; casa pelo número de chamado no assunto → **followup** em chamado
   existente, ou **novo** [[Ticket]].
2. Extrai corpo, remetente (vira solicitante) e **anexos** (viram [[Documentos (Document)]]).
3. Aplica **RuleMailCollector** ([[Tipos de Regra]]) para definir entidade, categoria e
   atribuição.
4. Trata coleta anti-spam/blacklist e respostas automáticas.

É o principal canal de abertura de chamados por e-mail, complementando UI e API.
