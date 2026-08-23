---
title: EV-2-f2-005 · Conceito e configuração de dropdowns
aliases: [EV-2-f2-005]
tags: [evidence, dropdown, configuration, translation]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/dropdowns/index.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-005 · Conceito e configuração de dropdowns

> [!quote] dropdowns/index.rst — "Dropdowns"
> Algumas listas suspensas (dropdowns) são configuráveis no GLPI, incluindo (mas não limitado a): **Locations, Status of items, Ticket categories, Software names, Manufacturers**. Alguns dropdowns têm valores padrão adicionados durante a instalação quando beneficiam muitos usuários (ex.: vários formatos de sistema de arquivos são definidos por padrão). A lista de tipos de dropdown **pode variar conforme o perfil atual do usuário**.

> [!quote] dropdowns/index.rst — tradução, estrutura e comentários
> As opções dos dropdowns podem ser **traduzidas em múltiplos idiomas**, porém esse recurso é **desabilitado por padrão**; pode ser habilitado em **Setup > General > General setup**, o que adiciona uma nova aba no formulário do dropdown para gerenciar as traduções. Alguns dropdowns são listas planas simples; outros podem ser organizados em **estrutura de árvore** definindo a opção pai. Todas as opções podem receber um **comentário** que aparece em outros formulários ao passar o mouse sobre o ícone **Help** ao lado do dropdown. Os tipos de dropdown que podem ser associados a entidades específicas exibem um ícone de **"stack"** (o mesmo do item de menu Entidade). Subseções: general, assistance, calendar, internet, others.

## Sustenta
- [[Catálogo de tipos de dropdown (configuração)]]
