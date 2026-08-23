---
title: Multi-Agent Systems
aliases:
  - Sistemas Multiagentes
  - MAS
  - Arquitetura Multiagente
tags:
  - ai
  - generative-ai
  - agentic-ai
  - architecture
type: concept
status: evergreen
source: How we built our multi-agent research system — Anthropic Engineering, 2025
author: Jeremy Hadfield, Barry Zhang, Kenneth Lien, Florian Scholz, Jeremy Fox e Daniel Ford (Anthropic)
created: 2026-07-25
---
> [!abstract]
> Um sistema multiagente é composto por **vários agentes** — LLMs usando ferramentas autonomamente em laço — trabalhando juntos em um problema que excede o que um agente isolado resolve.

## Conceito

Pesquisa e investigação são problemas abertos: não dá para prever os passos necessários de antemão, porque o processo é dinâmico e dependente do caminho. Quem pesquisa atualiza a abordagem continuamente conforme descobre coisas. Um pipeline linear de passo único não dá conta.

A essência da busca é **compressão**: destilar o essencial de um corpus vasto. Subagentes facilitam isso operando em paralelo, cada um com sua própria janela de contexto, explorando aspectos distintos antes de condensar o que importa para o agente líder. Cada subagente também traz separação de responsabilidades — ferramentas, prompts e trajetórias próprias — o que reduz a dependência de caminho.

> [!quote]
> "Multi-agent systems work mainly because they help spend enough tokens to solve the problem."

Na análise da Anthropic sobre a avaliação BrowseComp, três fatores explicaram 95% da variação de desempenho: **o uso de tokens sozinho explicou 80%**, seguido do número de chamadas de ferramenta e da escolha do modelo. Distribuir o trabalho entre agentes com janelas de contexto separadas é o que adiciona capacidade de raciocínio paralelo.

## Quando compensa

| Compensa | Não compensa |
|---|---|
| Tarefas com **paralelização pesada** | Tarefas com muitas dependências entre agentes |
| Informação que **excede uma janela de contexto** | Domínios em que todos os agentes precisam do mesmo contexto |
| Interação com **muitas ferramentas complexas** | A maioria das tarefas de programação, com poucos trechos realmente paralelizáveis |
| Consultas *breadth-first*, com direções independentes | Tarefas de baixo valor unitário |

> [!warning] O custo é a barreira econômica
> Agentes usam cerca de **4× mais tokens** que uma interação de chat; sistemas multiagentes, cerca de **15× mais**. Só faz sentido quando o valor da tarefa justifica o gasto.

## Fonte

- Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025

## Veja também

- [[Agentic AI]]
- [[Hierarquia de Agentes]]
- [[Agentes Especialistas]]
- [[Agentes Paralelos]]
- [[Agent Supervisor]]
- [[Agent Runtime]]
- [[AI Generative Architecture]]
- [[Agentic Workflow]]
- [[Plugin (AI Agent)]]
