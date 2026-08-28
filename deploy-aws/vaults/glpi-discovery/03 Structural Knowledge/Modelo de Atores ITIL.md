---
title: Modelo de Atores ITIL
aliases: [Atores ITIL, requester assign observer]
tags: [concept, itil, atores, dominio/service-desk]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-1-009 · Atores ITIL requester-assign-observer|EV-1-009]]"
author: CAD Discovery
created: 2026-07-10
---

# Modelo de Atores ITIL

Todo objeto ITIL ([[CommonITILObject (base de service desk)]]) tem **atores** em três papéis
(`CommonITILActor`): **Requester (1)** — quem solicita; **Assign (2)** — quem atende
(técnico/grupo/fornecedor); **Observer (3)** — quem acompanha.

## Matriz papel × tipo de ator
Cada papel pode ser preenchido por **usuário**, **grupo** ou **fornecedor**, via classes de
ligação (o `type` guarda o papel):

| Objeto | Usuário | Grupo | Fornecedor |
|---|---|---|---|
| Ticket | `Ticket_User` | `Group_Ticket` | `Supplier_Ticket` |
| Change | `Change_User` | `Change_Group` | `Change_Supplier` |
| Problem | `Problem_User` | `Group_Problem` | `Problem_Supplier` |

## Implicações
- Direitos `READ_ASSIGNED`/`READ_OWNED` ([[Perfis e Direitos (RBAC)]]) usam o papel do ator
  para restringir a visão do técnico aos chamados dele/do seu grupo.
- Notificações são endereçadas pelos atores (requester recebe atualizações; assign recebe
  atribuições).

> [!question]
> Regras de atribuição automática (por categoria/entidade) — ver
> [[Categorias e templates ITIL]] e o motor de regras (Módulo 5).
