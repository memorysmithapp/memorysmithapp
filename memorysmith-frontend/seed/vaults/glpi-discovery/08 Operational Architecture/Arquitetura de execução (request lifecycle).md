---
title: Arquitetura de execução (request lifecycle)
aliases: [Request lifecycle, roteamento, front controller]
tags: [infra, arquitetura, dominio/operacao]
type: infra
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
  - "[[EV-1-034 · API v2 HL Router REST GraphQL OAuth RSQL|EV-1-034]]"
author: CAD Discovery
created: 2026-07-10
---

# Arquitetura de execução (request lifecycle)

Resolve [[INV-1-001 · Roteamento Symfony vs entrypoints legados]].

`public/index.php` é o **front controller único**: toda requisição é convertida em
`Symfony\Request` e entregue a `Kernel::handle()` ([[Kernel e Bootstrap]]). Não há mais acesso
direto aos scripts legados — o kernel decide o destino:

```mermaid
flowchart TD
    R[HTTP request] --> IDX[public/index.php]
    IDX --> K[Kernel Symfony handle]
    K --> RT{roteamento}
    RT -- rota moderna --> C[Controller Glpi\\ ou API HL]
    RT -- caminho legado --> L[wrapper que inclui front/*.php ou ajax/*.php]
    C --> DOM[Domínio CommonDBTM]
    L --> DOM
    DOM --> DB[(MariaDB)]
    C --> TW[Twig]
    L --> TW
```

- **Rotas modernas** → controllers no namespace `Glpi\` (inclui a [[API REST e GraphQL]]).
- **Caminhos legados** (`/front/ticket.php`, `/ajax/...`) → o kernel os embrulha e executa o
  script legado, preservando compatibilidade durante a migração
  ([[ADR - Arquitetura híbrida Symfony + Active Record legado]]).
- Requisições do **agente** e da **API** entram pelo mesmo front controller.
