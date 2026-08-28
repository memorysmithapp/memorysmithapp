---
title: EV-2-g3-015 · Análise de Impacto (procedimento e conceitos)
aliases: [EV-2-g3-015]
tags: [evidence, tab, impact-analysis, dependency, diagram]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · source/tabs/impact_analysis.rst · Impact Analysis"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-015 · Análise de Impacto (procedimento e conceitos)

> [!quote] source/tabs/impact_analysis.rst — "Impact Analysis"
> "Impact analysis enables an infrastructure diagram to be drawn up, showing the dependencies and impacts in the event of equipment loss. This can be saved and exported."
> **Notions**: **Impact** (seta vermelha por padrão) — se o elemento tem problema, impacta todos os ligados; **Dependency** (seta azul) — elemento diretamente afetado pelo impacto, mas que não afeta necessariamente os ligados a ele. É preciso posicionar-se **no contexto do elemento** selecionado.
> **Criar**: o equipamento deve estar ligado (powered up). Em **Assets > Network devices**, selecionar o hardware; na aba **impact analysis** ele aparece; no menu à direita **+**, escolher a categoria, arrastar/soltar o hardware.
> **Adicionar links**: ícone **diagonal line**; segurar o mouse sobre o 1º elemento e soltar sobre o elemento a ligar.
> **Cores dos links**: vermelho = impacto (falha do elemento afeta os seguintes); azul = dependência; **roxo** = mutuamente dependentes/impactados (relação nos dois sentidos); **preto** = sem dependência nem impacto a partir do elemento atual.
> **Groups**: ícone object-group — agrupam elementos que dependem de outro equipamento; com nome e cor de fundo; apagar via clique direito (só apaga o grupo, não os itens).
> **Save**: ícone floppy. **Delete**: ícone trashbin (apaga elemento e link). **Download**: ícone downloading, formato **PNG**. **Maximize**: tela cheia; roda do mouse dá zoom.
> **Link configuration** (ícone adjustments): **Visibility** (mostrar só impactos e/ou dependências), **Colours** (cores de dependências, impactos e impactos de dependências), **Maximum depth** (número de elementos exibidos; "infinity" = sem limite).

## Sustenta
- [[Uso da Análise de Impacto (montar o diagrama de dependências)]]
- [[Aba Análise de Impacto (diagrama de dependências)]]
