---
title: Plugin (AI Agent)
aliases:
  - Plugin
  - Plugins
tags:
  - ai
  - agent
  - packaging
  - workflow
type: concept
status: seed
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> Um **Plugin** é um pacote instalável que reúne [[Agent Skill|skills]], [[Connector|conectores]] e agentes desenhados para um tipo específico de trabalho — vendas, finanças, jurídico — para que o assistente opere do jeito que aquele papel opera.

## Conceito

Skills e conectores são unidades **atômicas**: uma resolve um procedimento, o outro dá acesso a uma ferramenta. Montar um ambiente completo para um papel exige combinar vários dos dois, e essa montagem se repete em toda organização que tem aquele papel.

O plugin é a unidade de **distribuição** dessa combinação. Instala-se um pacote e obtém-se o conjunto coerente: os procedimentos daquele domínio, os acessos que ele precisa, e os agentes especializados que o executam.

## Comparação

| | [[Agent Skill\|Skill]] | [[Connector]] | Plugin |
|---|---|---|---|
| Unidade | Um procedimento | Um acesso | Um jeito de trabalhar |
| Escopo | Uma tarefa | Uma ferramenta | Um papel ou domínio |
| Composto de | Instruções + scripts + recursos | Cliente MCP + permissões | Skills + conectores + agentes |
| Distribuição | Arquivo ou diretório | Diretório de conectores | Marketplace de plugins |

## Características

- **Composto** — agrega unidades menores num conjunto coerente
- **Orientado a papel** — a fronteira é o trabalho de alguém, não uma capacidade técnica
- **Distribuível** — organizado em marketplaces, instalável e removível
- **Herda os riscos dos componentes** — contém código executável e permissões de acesso

> [!warning] Superfície de confiança agregada
> Instalar um plugin é instalar tudo que ele empacota de uma vez. A regra de procedência de [[Agent Skill|skills]] e [[Connector|conectores]] vale multiplicada: fonte confiável, e revisão do que vem dentro.

## Veja também

- [[Agent Skill]]
- [[Connector]]
- [[Claude Cowork]]
- [[Multi-Agent Systems]]
- [[Agentes Especialistas]]
