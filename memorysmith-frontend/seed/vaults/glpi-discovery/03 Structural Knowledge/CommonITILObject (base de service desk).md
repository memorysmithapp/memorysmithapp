---
title: CommonITILObject (base de service desk)
aliases: [CommonITILObject, base ITIL]
tags: [component, itil, dominio/service-desk]
type: component
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-008 · CommonITILObject define statuses e matriz de prioridade|EV-1-008]]"
  - "[[EV-1-009 · Atores ITIL requester-assign-observer|EV-1-009]]"
author: CAD Discovery
created: 2026-07-10
---

# CommonITILObject (base de service desk)

Classe **abstrata** que concentra tudo que [[Ticket]], [[Change]] e [[Problem]] têm em comum.
Estende [[CommonDBTM (Active Record)]] — logo herda ciclo de vida, direitos, entidade e busca —
e adiciona a semântica **ITIL**.

## O que define
- **Statuses** comuns: INCOMING(1), ASSIGNED(2), PLANNED(3), WAITING(4), SOLVED(5),
  CLOSED(6), ACCEPTED(7), OBSERVED(8), APPROVAL(10). Subclasses acrescentam os seus.
- **Prioridade** derivada da matriz **urgência × impacto** — ver [[Priorização (urgência × impacto)]].
- **Transições** de status governadas por matriz **por perfil** (`STATUS_MATRIX_FIELD`) —
  ver [[Ciclo de vida de um Ticket (máquina de estados)]].
- **Atores** em três papéis (requester/assign/observer) — ver [[Modelo de Atores ITIL]].
- **Timeline** de artefatos-filhos: followups, tasks, solução, validação — ver
  [[Fluxo de followups, tarefas e solução]].
- Interfaces **Kanban** e **Teamwork** (visões de board e trabalho em equipe).

## Subclasses
- [[Ticket]] — incidentes e requisições (service desk do dia a dia).
- [[Change]] — gestão de mudanças (fases avaliação/aprovação/teste/qualificação).
- [[Problem]] — gestão de problemas (causa-raiz).

> [!note] Por que importa para requisitos
> Praticamente todo requisito de service desk é uma configuração ou extensão desta base:
> statuses permitidos, quem pode transicionar, SLA aplicável, campos do template, atores.
