---
title: Abas de configuração da Entidade
aliases: [Entity tabs, Abas da entidade]
tags: [entidades, abas, configuracao, ui, doc]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e2-003 · Abas da entidade - Endereço e Avançado (regras genéricas e LDAP)|EV-2-e2-003]]"
  - "[[EV-2-e2-005 · Entidade - aba Assistência (templates, fechamento, satisfação)|EV-2-e2-005]]"
  - "[[EV-2-e2-006 · Entidade - abas Ativos, UI, Segurança, Helpdesk home, Usuários e Regras|EV-2-e2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O formulário de uma **entidade** é organizado em abas, que concentram a configuração herdável do multi-tenancy (ver [[Modelo de Entidades na administração (multi-tenancy)]]).

## Abas
- **Entities**: lista e adiciona sub-entidades.
- **Address**: dados administrativos/de contato — ver [[Campos administrativos e de endereço da entidade]].
- **Advanced information**: identificação técnica para regras de atribuição automática (TAG do inventário, DN LDAP, domínio de e-mail) e busca de usuários LDAP (directory + filter). Base para [[Regras de atribuição de item a entidade (inventário)]] e [[Regras de atribuição de autorizações ao usuário]].
- **Notifications**: opções de notificação e alarmes — ver [[Campos de notificação e alarmes da entidade]].
- **Assistance** (requer autorização *Read/Modify Entity Parameters*): templates, atribuição automática, anonimização de agentes, fechamento automático, pesquisa de satisfação, helpdesk — ver [[Campos de configuração de Assistência da entidade]].
- **Assets**: autofill de datas administrativo-financeiras, entidade de criação de software, transferência automática por inventário, inventário automático (multi-servidor), atualização de elementos ligados a computadores.
- **UI Customization**: CSS customizado por entidade (próprio, herdado ou desabilitado).
- **Security**: forçar ou não 2FA.
- **Helpdesk home**: personaliza a home do perfil self-service (tiles: GLPI page, External page, Form).
- **Users**: adiciona usuário com perfil (recursivo ou não).
- **Rules**: cria regras (atribuição de usuário, de item a entidade, de ticket via coletor).
- Abas comuns: **Documents, Notes, Historical, All**.

> [!note] Muitas opções admitem *Inheritance of the parent entity*
> Ver [[Herança de configuração entre entidades (fluxo)]].
