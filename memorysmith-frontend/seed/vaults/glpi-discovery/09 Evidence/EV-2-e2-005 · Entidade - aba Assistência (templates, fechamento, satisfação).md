---
title: EV-2-e2-005 · Entidade - aba Assistência (templates, fechamento, satisfação)
aliases: [EV-2-e2-005]
tags: [evidence, entidades, assistencia, satisfacao, fechamento, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/administration/entity/entities.rst · Assistance"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] Documentação (entities.rst, aba Assistance)
> Aba visível se a autorização *Read or Modify Entity Parameters* estiver concedida no perfil. Agrupa parâmetros de entidade aplicáveis a tickets.

**Templates configuration**: Ticket template / Change template / Problem template — template usado a cada criação.

**Tickets configuration**:
- **Calendar**: calendário padrão da entidade para cálculo do tempo de resolução e deslocamento da data-alvo; pré-selecionado ao criar um SLA.
- **Ticket Default Type**: tipo predefinido (útil na criação via coletor de e-mail).
- **Automatic assignment of tickets, changes and problems**: *No* / *based on item then on category* / *based on category then on item*.
- **Mark followup added by a supplier through an email collector as private**: No/Yes/Herança.
- **Anonymize support agents**: várias opções (Disabled; substituir nome do agente e grupo por nome genérico ou apelido customizável; substituir só o nome do agente; só o nome do grupo…). `.. tip::` ao usar nome customizado, um novo campo *nickname* aparece no perfil de grupo/usuário.
- **Display initials for users without picture**: No/Yes/Herança.
- **Default contract**: Herança / Contact in ticket entity.

**Automatic closing configuration**: `.. hint::` se aparecer "Purge ticket action is disabled", ativar a ação `purgeticket` em Setup > Automatic actions.
- **Automatic closing of solved ticket after**: fechamento "administrativo"; se *immediately*, bloqueia a aprovação da solução pelo requerente (executado por ação automática). De never a 365 dias.
- **Automatic purge of closed tickets after**: never a 365 dias.

**Configuring the satisfaction survey (Tickets)**: External ou internal (external exibe campo URL); *Create survey after* (0 a 90 dias após resolução); *Rate to trigger survey* (Disabled a 100%); *Duration of survey*; *Max rate* (1..10); *Default rate*; *Comment required if score <=* (1..10); *For tickets closed after* (data de ativação, para excluir tickets antigos). `.. note::` outra aba permite pesquisas de satisfação para *changes*, com as mesmas opções.

**Helpdesk**: *Show tickets properties on helpdesk* — exibir ou não informação de tickets visível a perfis self-service.

## Sustenta
- [[Campos de configuração de Assistência da entidade]]
- [[Tags de URL da pesquisa de satisfação]]
- [[Abas de configuração da Entidade]]
