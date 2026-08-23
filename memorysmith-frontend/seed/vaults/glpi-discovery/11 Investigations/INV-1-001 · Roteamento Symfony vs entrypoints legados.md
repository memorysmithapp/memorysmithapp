---
title: INV-1-001 · Roteamento Symfony vs entrypoints legados
aliases: [INV-1-001]
tags: [investigation, consumidor/cad, arquitetura]
type: investigation
status: confirmed
source:
  - "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
  - "[[EV-1-034 · API v2 HL Router REST GraphQL OAuth RSQL|EV-1-034]]"
author: CAD Discovery
created: 2026-07-10
---

# INV-1-001 · Roteamento Symfony vs entrypoints legados

> [!success] Resolvida (Módulo 6)
> `public/index.php` é o **front controller único**: toda requisição vira `Symfony\Request` e
> passa por `Kernel::handle()`. O kernel roteia para **controllers modernos** (`Glpi\`, incl.
> API HL) ou **embrulha** os scripts legados `front/*.php`/`ajax/*.php`. Não há acesso direto
> aos scripts. Detalhe em [[Arquitetura de execução (request lifecycle)]].

> [!question] Pergunta original
> Como uma requisição é roteada no GLPI 11 e como Symfony convive com os scripts legados?
