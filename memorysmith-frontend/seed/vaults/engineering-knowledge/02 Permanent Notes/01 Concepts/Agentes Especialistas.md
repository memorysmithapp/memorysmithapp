---
title: Agentes Especialistas
aliases:
  - Subagentes
  - Specialized Subagents
  - Subagent
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
> Agentes especialistas são subagentes com **prompt, ferramentas e janela de contexto próprios**, cada um encarregado de uma fatia da tarefa — a unidade de trabalho de uma [[Hierarquia de Agentes]].

## Conceito

A especialização traz três ganhos que se reforçam:

1. **Separação de responsabilidades** — ferramentas, prompts e trajetórias distintos reduzem a dependência de caminho e permitem investigações independentes e completas
2. **Janela de contexto própria** — cada um explora sem consumir o contexto dos demais nem do líder
3. **Compressão** — o subagente devolve apenas os tokens que importam, não tudo que leu

## Ferramenta certa é pré-requisito

> [!important] A interface agente-ferramenta é tão crítica quanto a interface humano-computador
> Um agente que busca na web um contexto que só existe no Slack está condenado desde o início. Com servidores [[Model Context Protocol (MCP)]] dando acesso a ferramentas externas, o problema se agrava: os agentes encontram ferramentas desconhecidas com descrições de qualidade muito variável.
>
> As heurísticas explícitas que funcionaram: examinar todas as ferramentas disponíveis primeiro, casar o uso com a intenção do usuário, buscar na web para exploração externa ampla e **preferir ferramentas especializadas às genéricas**.

A Anthropic criou um agente de teste de ferramentas: dada uma ferramenta MCP defeituosa, ele tenta usá-la e **reescreve a descrição** para evitar as falhas. Testando dezenas de vezes, encontrou nuances e bugs — e a nova descrição reduziu em 40% o tempo de conclusão de tarefas dos agentes seguintes.

## Estratégia de busca

**Começar amplo, depois estreitar.** A estratégia deve espelhar a do pesquisador humano experiente: explorar o panorama antes de aprofundar. Agentes tendem a começar com consultas longas e específicas demais, que retornam poucos resultados — a correção é prompt que force consultas curtas e amplas primeiro.

> [!tip] Saída para o sistema de arquivos
> Em vez de tudo passar pelo líder, o subagente pode gravar o resultado num artefato externo e devolver apenas uma referência leve. Isso evita a perda de informação do "telefone sem fio" e reduz o custo de copiar saídas grandes pelo histórico da conversa. Funciona especialmente bem para saídas estruturadas — código, relatórios, visualizações.

## Fonte

- Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), 2025

## Veja também

- [[Hierarquia de Agentes]]
- [[Multi-Agent Systems]]
- [[Ferramentas Compartilhadas]]
- [[Model Context Protocol (MCP)]]
- [[Agent Runtime]]
- [[AI Generative Architecture]]
