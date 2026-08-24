---
title: Componentes de Hardware Configuráveis
aliases: [Components, Componentes de hardware, Device components]
tags: [componentes, hardware, ativos, configuracao]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-004 · Componentes de hardware configuráveis|EV-2-f1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Os **componentes de hardware** que podem ser adicionados a computadores são configuráveis em **Setup > Components**. Correspondem, no código, à [[Composição de um Ativo (componentes)]].

## Definição de um componente
Um componente é definido por **tipo**, **nome**, **fabricante**, **comentário** e campos específicos do tipo (ex.: chipset para placa-mãe; campos próprios para Processor — aba **Main**).

- É possível preencher outros tipos dentro do tipo *Other Components*, mas **não** se pode adicionar tipos além dos listados (Motherboard, Processor...).
- Ao selecionar um tipo, redireciona à lista de componentes já criados.

## Abas do componente
- **Main**: informações que definem o componente (variam por tipo).
- **Items**: computadores ligados ao componente. As características de um componente só podem ser modificadas **para o item vinculado** (via *Elements* > Update), abrindo abas: Element–Component link, [[Management]] (financeiro/administrativo), Documents, Locks, Historical, Contracts, All.
- **Projects**: ver/associar projetos existentes ao componente (não cria novos) — ver código [[Projetos (Project)]].
- Também há abas Documents, Historical e All.

> [!note]
> Liga-se a [[Gestão de Ativos e Configuração (SACM)]] e ao [[Modelo de Ativos (padrão comum)]].
