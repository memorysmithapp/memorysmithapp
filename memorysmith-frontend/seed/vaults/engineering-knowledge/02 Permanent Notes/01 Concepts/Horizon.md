---
title: Horizon
aliases:
  - OpenStack Dashboard
tags:
  - openstack
  - dashboard
  - ui
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Interface web do OpenStack: dashboard em Django que expõe as APIs dos serviços em operações de ponto e clique.

## Conceito

Não veio nos primeiros releases — nasceu no **Essex**, quando o ecossistema já tinha massa crítica de serviços. É construído sobre o framework Django e opera atrás de um servidor Apache.

Seu limite é estrutural e vale conhecer: **um serviço novo não aparece sozinho no dashboard**. Por desenho modular, cada serviço precisa de um módulo Horizon próprio, declarado como painel. Operações avançadas — configuração fina de rede, por exemplo — só existem na CLI.

## Características

- Suporta a maioria das APIs dos serviços core.
- Painéis adicionais (Magnum, Zun, Manila, Watcher) existem, mas vêm desabilitados por padrão.
- Sendo Django, **satura com volume de usuários** — escalar o dashboard é expectativa, não exceção, quando muitos painéis são expostos a uma audiência ampla.

> [!tip] Horizon é suficiente para setup pequeno
> Com boa referência de CLI, o dashboard administra confortavelmente um ambiente enxuto. Com dezenas de projetos e centenas de recursos, a operação migra para CLI e automação.

## Veja também

- [[OpenStack]]
- [[Keystone]]
