---
title: Constitutional AI
aliases:
  - CAI
  - IA Constitucional
tags:
  - ai
  - generative-ai
  - alignment
  - ai-governance
type: concept
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> **Constitutional AI** é a abordagem de alinhamento em que o comportamento de um modelo é treinado contra um conjunto **explícito e escrito** de princípios — a "constituição" — em vez de depender apenas de rótulos humanos caso a caso.

## Conceito

O problema que a técnica resolve é de **escala e transparência** do alinhamento. Alinhar um modelo apenas por feedback humano exige que uma pessoa julgue cada resposta problemática, o que não escala e deixa os critérios implícitos: ninguém consegue auditar o que exatamente foi ensinado.

Na Constitutional AI, os critérios saem da cabeça dos anotadores e viram texto. O modelo é treinado a **criticar e revisar as próprias saídas** contra esses princípios, reduzindo a dependência de julgamento humano ponto a ponto e tornando o alvo do alinhamento inspecionável.

O objetivo declarado é um sistema **helpful, harmless and honest**: útil, que evita saídas tóxicas ou discriminatórias, que não colabora com atividade ilegal ou antiética, e que opera de forma transparente.

## Características

- **Princípios explícitos** — o critério é documento, não intuição do anotador
- **Autocrítica supervisionada** — o modelo revisa as próprias respostas contra a constituição
- **Escalabilidade** — reduz o gargalo do rótulo humano por resposta
- **Auditabilidade** — o que se pretendeu ensinar é legível por terceiros
- **Steerability** como efeito colateral — um modelo alinhado por princípios aceita direção sobre tom e comportamento com menos esforço de prompt

> [!important] Alinhamento não é filtro
> Um filtro atua **depois** da geração, bloqueando saídas. Constitutional AI atua **no treinamento**, moldando a política do modelo. São camadas complementares, não substitutas — a maioria dos sistemas de produção usa as duas.

## Comparação

| | Constitutional AI | RLHF clássico |
|---|---|---|
| Fonte do critério | Constituição escrita | Preferência humana por par de respostas |
| Custo de anotação | Baixo após redigir os princípios | Alto e contínuo |
| Auditabilidade | Alta — os princípios são texto | Baixa — o critério fica no dado |
| Ajuste de política | Editar a constituição | Recoletar preferências |

## Relação com governança

Do ponto de vista de [[ITIL AI Capability Model|governança de IA]], a constituição é um **artefato de política** que pode ser versionado, revisado e usado como evidência de conformidade. Isso a aproxima mais de um controle de governança do que de um detalhe de treinamento.

## Veja também

- [[Large Language Model (LLM)]]
- [[Human-in-the-Loop]]
- [[AI Fluency]]
- [[Agentic AI]]
