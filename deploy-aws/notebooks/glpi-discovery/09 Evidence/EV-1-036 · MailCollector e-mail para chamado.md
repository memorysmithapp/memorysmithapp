---
title: EV-1-036 · MailCollector — e-mail para chamado
aliases: [EV-1-036]
tags: [evidence, dominio/integracoes, email]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · src/MailCollector.php L73 · src/RuleMailCollector.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-036 · MailCollector — e-mail para chamado

> [!quote] `src/MailCollector.php`
> ```php
> class MailCollector extends CommonDBTM { ... }  // caixa IMAP monitorada
> // + RuleMailCollector: roteia/atribui os chamados criados por e-mail
> ```

O **MailCollector** monitora caixas de e-mail (IMAP) e transforma mensagens recebidas em
**chamados** (ou followups em chamados existentes, casando pelo número no assunto). Anexos
viram [[Documentos (Document)|documentos]]. As **RuleMailCollector** ([[Tipos de Regra]])
decidem entidade, categoria e atribuição do chamado criado. Executado por
[[Ações Automáticas (CronTask)|cron]].

## Sustenta
- [[Coletor de E-mail (MailCollector)]]
- [[Gestão de Incidentes e Requisições (processo)]]
