---
title: EV-2-f1-008 · Configuração de assistência
aliases: [EV-2-f1-008]
tags: [evidence, assistencia, service-desk, configuracao-geral]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/general/assistance.rst · Assistance"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/assistance.rst — "Assistance"
> "This tab allows management of GLPI assistance part."
> **Assistance**:
> - Step for the hours (minutes): intervalo entre passos nos dropdowns de duração.
> - Default file size limit imported by the mails receiver: ajustar junto do management tab e do `max_upload_size` do PHP.
> - Default heading when adding a document to a ticket.
> - Keep tickets when purging hardware in the inventory: mantém tickets do ativo purgado.
> - Allow anonymous ticket creation (receiver): desativado por padrão; necessário ao usar coletor de e-mail para criar tickets de usuários não reconhecidos.
> - Limit of the schedules for planning: faixa horária exibida no planejamento.
> - By default, a software may be linked to a ticket.
> - Show personal information in new ticket form (simplified information): exibe nome, telefone e localização do usuário; botão Edit vai às preferências.
> - Allow anonymous followups (receiver): usuário ausente no GLPI pode responder a um e-mail do GLPI.
> **Matrix of calculus for priority**: define a prioridade do ticket conforme impacto e urgência; a disponibilidade dos níveis é configurável, mas o nível **Medium não pode ser deletado**.

## Sustenta
- [[Configuração do Módulo de Assistência (Setup)]]
