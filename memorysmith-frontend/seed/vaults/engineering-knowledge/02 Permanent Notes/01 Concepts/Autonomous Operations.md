---
title: Autonomous Operations
aliases:
  - Operações Autônomas
  - Self-Healing
tags:
  - itil
  - ai
  - operations
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Autonomous Operations é o estágio em que sistemas detectam, decidem e executam ações corretivas sobre a operação sem intervenção humana no ciclo.

## Conceito

É a continuação natural de [[AIOps]] com um salto qualitativo: o sistema deixa de recomendar e passa a agir. Isso muda a natureza do risco — o erro não é mais uma sugestão ignorável, é uma ação executada.

O desenho responsável define três coisas de antemão: o escopo do que pode ser feito autonomamente, o gatilho que devolve o controle ao humano, e a reversibilidade de cada ação permitida.

## Níveis

| Nível | Papel do sistema | Papel do humano |
|---|---|---|
| Assistido | Sugere | Decide e executa |
| Supervisionado | Decide e propõe execução | Aprova |
| Autônomo com limite | Executa dentro do escopo definido | Monitora e intervém |
| Autônomo | Executa e adapta | Define política |

## Veja também

- [[AIOps]]
- [[Agentic AI]]
- [[ITIL AI Governance]]
- [[Human-in-the-Loop]]
- [[Optimize and Automate]]
