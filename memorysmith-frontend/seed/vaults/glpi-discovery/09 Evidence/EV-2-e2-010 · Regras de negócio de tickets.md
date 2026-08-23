---
title: EV-2-e2-010 · Regras de negócio de tickets
aliases: [EV-2-e2-010]
tags: [evidence, regras, negocio, tickets, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/administration/rules/ticketbusinessrules.rst · Business rules for tickets"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (ticketbusinessrules.rst)
> "A mechanism is available to modify the attributes of the ticket automatically when a ticket is opened or updated."

**Critérios disponíveis**: todos os atributos do ticket (título, descrição, status, categoria, urgência, impacto, prioridade, fonte da requisição, tipo de ativo, grupo/usuário/localização requerente, atribuído a fornecedor/grupo/técnico, entidade) e outros ligados a coletores de e-mail (headers…).

**Ações possíveis**: modificar atributos do ticket (status, categoria, urgência, impacto, prioridade, grupo/usuário/localização requerente, atribuído a fornecedor/grupo/técnico); **atribuir o ticket a um dispositivo** conforme dados presentes (atribuição por IP, nome completo + domínio, MAC); ou **enviar uma solicitação de validação**.

- `.. note::` regras de negócio podem ser executadas **na abertura e/ou na atualização** conforme parâmetro da regra. Na atualização, só os campos modificados disparam as regras (regra cujos critérios correspondem a campos não modificados não é executada).
- `.. warning::` o motor executa **todas as regras em sequência**, passando o resultado da anterior à atual; se uma regra anterior modificou um atributo usado pela atual, é o valor modificado que será processado.
- **Multi-entidade**: as regras de negócio de tickets podem ser **recursivas** (definidas numa entidade e aplicadas nela e nas sub-entidades). Três abas: *applied rules (entity name)* (regras das entidades-pai, se houver a autorização *Business rules (parent)*); *local rules* (da entidade atual); *rules applicable in sub-entities*.
- `.. warning::` caso especial de Urgência/Impacto: ao defini-los via regra de negócio, adicionar também a ação **Recalculate priority**.

## Sustenta
- [[Regras de negócio de tickets (administração)]]
