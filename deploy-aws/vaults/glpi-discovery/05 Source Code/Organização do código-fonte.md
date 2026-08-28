---
title: Organização do código-fonte
aliases: [Estrutura de pastas, Layout do repositório]
tags: [source-code, arquitetura, dominio/foundation]
type: module
maturity: evergreen
reviewed: false
source: "[[EV-1-004 · Kernel Symfony MicroKernel envolve o legado|EV-1-004]]"
author: CAD Discovery
created: 2026-07-10
---

# Organização do código-fonte

Layout do repositório GLPI 11.0.7 (`SRC-001`), observado por varredura de diretórios.

## Camadas principais

| Pasta | Papel | Observado |
|---|---|---|
| `src/*.php` | **Domínio legado** — ~1.586 classes flat no namespace global (`Computer`, `Ticket`, `Contract`, `CommonDBTM`…). | Núcleo Active Record. |
| `src/Glpi/**` | **Core moderno** namespaced `Glpi\` — `Kernel`, `Search\Provider`, `Api\HL`, `Inventory`, `Agent`, `DBAL`, `Plugin`, `RichText`, `Application`, `Features`. | Código novo. |
| `front/*.php` | **Controllers de página legados** (329 arquivos): `*.form.php` (edição), `*.php` (listagem). | Ex.: `change.form.php`. |
| `ajax/*.php` | **Endpoints AJAX legados**. | — |
| `public/` | Document root / assets compilados / `index.php`. | Ponto de entrada web. |
| `templates/` | **Views Twig**. | — |
| `install/` | Instalador, `mysql/glpi-empty.sql` (schema), migrações. | Ver Módulo 6. |
| `locales/` | Traduções (i18n). | — |
| `tests/` | Testes (functional, unit, e2e). | — |
| `tools/` | Scripts utilitários/CLI. | — |

## Leitura arquitetural
GLPI 11 está em **migração progressiva**: o padrão histórico (páginas `front/` procedurais
+ classes `src/*.php` Active Record) coexiste com uma camada Symfony/namespaced (`src/Glpi/`).
Ver [[Kernel e Bootstrap]] e o [[ADR - Arquitetura híbrida Symfony + Active Record legado]].

> [!note] Para extração de requisitos
> A regra de negócio "verdadeira" tende a estar nas classes `src/*.php` (métodos
> `prepareInputForAdd`, `post_*`, `can*`), não nas páginas `front/`, que orquestram a UI.
