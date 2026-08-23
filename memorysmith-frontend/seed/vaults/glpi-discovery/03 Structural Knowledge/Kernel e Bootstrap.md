---
title: Kernel e Bootstrap
aliases: [Kernel, Bootstrap, Symfony Kernel]
tags: [component, arquitetura, dominio/foundation]
type: component
status: confirmed
source: "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
author: CAD Discovery
created: 2026-07-10
---

# Kernel e Bootstrap

O ponto de entrada do GLPI 11 é um **Kernel Symfony** (`Glpi\Kernel\Kernel`, usa
`MicroKernelTrait`, estende `Symfony\...\HttpKernel\Kernel`). Ele inicializa a configuração
do sistema (`SystemConfigurator`), o container de DI, o roteamento e o Twig, e resolve o
ambiente (`Environment` — prod/dev/test) para decidir se recompila cache.

## Papel
- **Bootstrap moderno**: DI, routing, Twig, tratamento de erros/logger.
- **Ponte para o legado**: convive com o núcleo procedural/active-record em `src/*.php`.
  Ver [[Organização do código-fonte]] e o [[ADR - Arquitetura híbrida Symfony + Active Record legado]].
- Bundles carregados: FrameworkBundle, TwigBundle e, em dev, DebugBundle/WebProfilerBundle.

> [!question] A aprofundar (Módulo 6)
> Rotas Symfony vs entrypoints PHP legados (`ajax/*.php`, `front/*.php`), a resolução do
> `SystemConfigurator` e a estratégia de cache do kernel.
