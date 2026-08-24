---
title: Collectors de e-mail no Assistance
aliases: [Mail collectors do ticket, Abertura por e-mail]
tags: [assistance, ticket, collector, mail, integration]
type: integration
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-b1-004 · Abertura padrão, por e-mail e automática|EV-2-b1-004]]"
  - "[[EV-2-b1-008 · Recursos avançados de tickets (collectors, fechamento, satisfação)|EV-2-b1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Collectors de e-mail no Assistance

Ferramentas externas interagem com o módulo Assistance via **mail collectors**: o e-mail **cria tickets** e **adiciona followups** a tickets existentes. Uma tarefa interna do GLPI conecta a uma caixa de correio e busca as mensagens.

## Fluxo de criação por e-mail
`Mail box → Collector → Rules (atribuição de entidade) → Business rules → ticket criado`

Mapeamento: objeto → título; corpo → descrição; `Cc:` → observadores (se conhecidos); anexos → documentos. Com **Use rich text for assistance**, imagens do corpo ficam visíveis na descrição.

## Fluxo de resposta (followup)
`Mail box → Collector → criação de followup no ticket relacionado`

> [!warning] Limitação
> A **solução** e o **fechamento** de um ticket **não** estão disponíveis via collectors.

## Ver também (código)
- [[Coletor de E-mail (MailCollector)]] · [[Notificações (e-mail e canais)]] · [[Motor de Regras de Negócio (capacidade)]]
