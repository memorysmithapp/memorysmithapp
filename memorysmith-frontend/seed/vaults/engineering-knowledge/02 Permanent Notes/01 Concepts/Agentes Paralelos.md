---
title: Agentes Paralelos
aliases:
  - Parallel Agents
  - Paralelização de Agentes
  - Parallel Tool Calling
tags:
  - ai
  - generative-ai
  - agentic-ai
  - performance
type: concept
status: evergreen
source: How we built our multi-agent research system — Anthropic Engineering, 2025
author: Jeremy Hadfield, Barry Zhang, Kenneth Lien, Florian Scholz, Jeremy Fox e Daniel Ford (Anthropic)
created: 2026-07-25
---
> [!abstract]
> Paralelizar agentes e chamadas de ferramenta é o que transforma pesquisa de horas em minutos — a otimização de maior impacto isolado em sistemas multiagentes.

## Conceito

Tarefas complexas envolvem explorar muitas fontes. Agentes que executam buscas **sequenciais** são dolorosamente lentos, e a serialização é desperdício puro quando as investigações são independentes entre si.

A Anthropic introduziu paralelização em dois níveis:

```mermaid
flowchart TD
    L[Agente líder] --> S1[Subagente 1]
    L --> S2[Subagente 2]
    L --> S3[Subagente 3]
    S1 --> T1[3+ ferramentas<br/>em paralelo]
    S2 --> T2[3+ ferramentas<br/>em paralelo]
    S3 --> T3[3+ ferramentas<br/>em paralelo]
```

1. O líder cria **3–5 subagentes em paralelo**, em vez de serialmente
2. Cada subagente usa **3 ou mais ferramentas em paralelo**

> [!important] O resultado
> Essas duas mudanças reduziram o tempo de pesquisa em **até 90%** para consultas complexas, permitindo cobrir mais informação em minutos em vez de horas.

## O limite atual: execução síncrona

> [!warning]
> Os agentes líderes executam subagentes de forma **síncrona**, esperando cada conjunto terminar antes de prosseguir. Isso simplifica a coordenação, mas cria gargalos: o líder não consegue redirecionar subagentes em andamento, os subagentes não se coordenam entre si, e o sistema inteiro pode ficar bloqueado esperando um único subagente terminar.
>
> Execução assíncrona permitiria mais paralelismo, com agentes trabalhando concorrentemente e criando novos subagentes conforme necessário — ao custo de coordenação de resultados, consistência de estado e propagação de erro entre subagentes.

Esse trade-off é o mesmo de qualquer sistema concorrente: mais paralelismo, mais dificuldade de garantir ordem e consistência. Ver [[Race Condition]] e [[Distributed Systems]].

## Onde a paralelização brilha

Avaliações internas mostram que sistemas multiagentes se destacam especialmente em consultas *breadth-first*, que envolvem perseguir **múltiplas direções independentes ao mesmo tempo** — o caso em que um agente único faz buscas lentas e sequenciais e frequentemente não chega à resposta.

## Fonte

- Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025

## Veja também

- [[Multi-Agent Systems]]
- [[Hierarquia de Agentes]]
- [[Agentes Especialistas]]
- [[Agent Runtime]]
- [[Race Condition]]
- [[AI Generative Architecture]]
