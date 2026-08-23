---
title: Herança de configuração entre entidades (fluxo)
aliases: [Inheritance of the parent entity, Herança de entidades]
tags: [entidades, heranca, configuracao, multi-tenancy, doc]
type: flow
status: confirmed
source:
  - "[[EV-2-e2-004 · Entidade - Notificações e Alarmes (herança)|EV-2-e2-004]]"
  - "[[EV-2-e2-002 · Entidades - conceito, hierarquia e isolamento (multi-tenancy)|EV-2-e2-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Em modo multi-entidade, muitos parâmetros de configuração admitem o valor **"Inheritance of the parent entity"**, formando uma cadeia de herança descendente na árvore de entidades.

## Princípio
- Define-se um parâmetro **uma vez na entidade raiz** e cada entidade-filha, por padrão, **herda** o valor da entidade-pai.
- Em qualquer nível pode-se **sobrepor** o valor herdado, refinando a configuração localmente.
- Se o refinamento por entidade não é desejado, basta configurar tudo na raiz.

## Onde a herança aparece
- **Notificações e alarmes** (delay de envio, habilitar notificações, limiares de consumíveis/cartuchos, alarmes de contatos/licenças/certificados/domínios/reservas/tickets) — ver [[Campos de notificação e alarmes da entidade]].
- **Assistência** (marcar follow-up de fornecedor como privado, anonimização de agentes, contrato padrão…) — ver [[Campos de configuração de Assistência da entidade]].
- **UI Customization** (herdar CSS do pai).

> [!warning] Alarmes dependem de ação automática
> Cada opção de alerta está associada a uma **ação automática**; se ela for desabilitada pelo administrador, nenhuma notificação é enviada. Ver [[Ações Automáticas (CronTask)]].

> [!note] Ponte doc×código
> Complementa [[Modelo de Entidades (multi-tenancy)]] e [[Recursividade em entidades]] com a semântica de herança de configuração.
