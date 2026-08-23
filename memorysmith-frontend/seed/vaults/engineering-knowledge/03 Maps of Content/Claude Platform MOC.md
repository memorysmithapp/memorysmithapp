---
title: Claude Platform MOC
aliases:
  - Claude MOC
  - Plataforma Claude
tags:
  - ai
  - generative-ai
  - claude
  - moc
type: moc
status: evergreen
source: Claude 101 — Anthropic Academy; Claude Use Cases (Product Cowork) — claude.com
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> Mapa do domínio **trabalho assistido por IA de propósito geral**, a partir da plataforma Claude: como se conversa com um assistente, como se organiza conhecimento e processo em torno dele, como se amplia seu alcance às ferramentas, e como se delega trabalho inteiro em vez de perguntas.

# Visão Geral

O domínio se organiza em seis camadas. As do meio são o que muda entre um uso amador e um uso fluente da IA; a última é a que transforma um trabalho delegado bem-sucedido em capacidade instalada.

```mermaid
mindmap
  root((Claude Platform))
    Fundamentos
      Constitutional AI
      Context Window
      Extended Thinking
    Interação
      Prompt em Três Camadas
      Iteração sobre a Resposta
      AI Fluency
      Eval
    Organização
      Project Workspace
      Artifact
      Agent Skill
      Agent Memory
    Alcance
      Connector
      MCP
      Enterprise Search
      Agentic Research
      Computer Use
    Delegação
      Agentic Workflow
      Work in a Folder
      Plano Revisável
      Observabilidade de Sessão
      Cowork e Code
    Escala
      Skill
      Scheduled Task
      Plugin
      Continuidade entre Superfícies
```

# Fundamentos

O substrato: como o modelo é alinhado, quanto ele consegue considerar de uma vez, e quando vale fazê-lo pensar antes de responder.

- [[Constitutional AI]]
- [[Context Window]]
- [[Extended Thinking]]
- [[Large Language Model (LLM)]]

# Interação

A camada de competência humana. É aqui que a diferença de resultado entre duas pessoas usando a mesma ferramenta se explica.

- [[AI Fluency]] — as quatro competências do 4D Framework
- [[Prompt em Três Camadas]] — palco, tarefa, regras
- [[Especificação de Entregável]] — declarar o objeto que volta, não só o comportamento
- [[Iteração sobre a Resposta da IA]] — diagnóstico e correção
- [[Escolha do Modelo para a Tarefa]] — densidade do insumo × acabamento da saída
- [[Eval]] · [[Eval Leve de Tarefas com IA]] — medir se serve para *o seu* trabalho

# Organização do conhecimento e do processo

O que persiste entre conversas. A distinção estruturante: **projeto guarda conhecimento, skill executa processo, artifact é o produto**.

- [[Project Workspace]] · [[Configuração de Projeto de IA]]
- [[Agent Skill]] · [[Criação de Skill por Conversa]]
- [[Artifact]]
- [[Agent Memory]]
- [[Retrieval-Augmented Generation (RAG)]] — como o projeto escala além da janela

# Alcance às ferramentas e à informação

Tirar o assistente do isolamento da caixa de texto. O efeito não é resposta melhor — é **espaço de perguntas maior**.

- [[Connector]] — acesso a ferramentas externas
- [[Model Context Protocol (MCP)]] — o padrão por trás
- [[Enterprise Search]] — consulta unificada ao conhecimento da organização
- [[Agentic Research]] — investigação multi-etapa autodirigida
- [[Computer Use]] — o último recurso quando não há conector

# Delegação de trabalho

Entregar um resultado em vez de uma pergunta, e a mecânica que torna a delegação revisável.

- [[Agentic Workflow]] — a forma
- [[Escolha da Forma de Trabalho com IA]] — como reconhecê-la antes de começar
- [[Claude Cowork]] · [[Claude Code]] — as superfícies
- [[Work in a Folder]] — a pasta como insumo, destino e unidade de permissão
- [[Plano Revisável]] — o ponto de correção mais barato do fluxo
- [[Observabilidade de Sessão Agêntica]] — conduzir enquanto executa
- [[Human-in-the-Loop]] — o controle que a delegação preserva

## Práticas de delegação

- [[Auditoria de Pasta contra Regras]] — confrontar uma coleção contra um documento normativo
- [[Síntese Multi-Fonte]] — o padrão que nenhuma fonte mostra sozinha
- [[Especificação de Entregável]] — quantidade, formato, invariante, lista do que mudou

# Escala do trabalho delegado

O que fazer depois que um fluxo funcionou uma vez.

- [[Da Conversa à Skill e ao Agendamento]] — a escada: conversa → skill → agendamento → plugin
- [[Agent Skill]] — o degrau que congela método, não dados
- [[Scheduled Task]] — a recorrência
- [[Plugin (AI Agent)]] — o empacotamento por papel
- [[Continuidade de Contexto entre Superfícies]] — Cowork → planilha → editor sem reexplicar
- [[Agentes Paralelos]] — subagentes para as etapas independentes

# Literatura

- [[Claude 101]] — curso da Anthropic Academy
  - [[Claude 101 01|Meet Claude]] · [[Claude 101 02|Organizando trabalho e conhecimento]] · [[Claude 101 03|Ampliando o alcance]] · [[Claude 101 04|Colocando tudo junto]] · [[Claude 101 05|Conclusão]]
- [[Claude Cowork Use Cases]] — biblioteca oficial de casos de uso, filtro Product = Cowork
  - [[Claude Cowork Use Cases 01|01 Arquivos locais]] · [[Claude Cowork Use Cases 02|02 Síntese multi-fonte]] · [[Claude Cowork Use Cases 03|03 Cadeia de superfícies]]

# Pontes com outros clusters

| Ponte | Liga |
|---|---|
| [[Model Context Protocol (MCP)]] | Esta plataforma ao cluster de [[AI Generative Architecture\|arquitetura de IA generativa]] |
| [[Retrieval-Augmented Generation (RAG)]] | Organização de conhecimento à camada de recuperação |
| [[Human-in-the-Loop]] | Delegação à governança de IA do [[ITIL 5]] |
| [[Agentic AI]] · [[Multi-Agent Systems]] | Fluxo agêntico à arquitetura multiagente |
| [[Eval]] | Discernimento ao [[Service Validation and Testing]] do ITIL |
| [[Knowledge Management]] | [[Enterprise Search]] à prática ITIL de gestão do conhecimento |
| [[Observabilidade de Sessão Agêntica]] | Sessão agêntica à [[Observability\|observabilidade]] de sistemas distribuídos |
| [[Auditoria de Pasta contra Regras]] | Trabalho delegado às práticas de [[Compliance]] e [[Information Security Management]] |

# Perguntas de Pesquisa

> [!success] Lacuna fechada
> **Cowork em profundidade** foi coberta pela leitura da biblioteca de casos de uso ([[Claude Cowork Use Cases]]): acesso a pasta, plano revisável, painéis de sessão, handoff entre superfícies e a escada skill → agendamento → plugin. O que permanece aberto do tema é a **governança de permissões** — limites de escopo, políticas organizacionais e auditoria de acesso concedido —, que a fonte trata só como recomendação de bom senso.

> [!question] Lacunas conhecidas deste domínio
> - **Governança de permissões no trabalho agêntico** — escopo concedido, revogação, auditoria de acesso. Falta fonte primária.
> - **Claude Code em profundidade** — fluxos de desenvolvimento, modos de autonomia na prática. Fonte: curso *Claude Code in Action*.
> - **Anatomia técnica de uma Skill** — estrutura de diretório, frontmatter, carregamento progressivo. Falta fonte primária.
> - **Escrita de servidor MCP** — do lado do provedor, não do consumidor. Complementaria [[Model Context Protocol (MCP)]].
> - **Prompt injection e defesa em agentes** — mencionado de raspão em [[Computer Use]]; merece nota própria, com ponte para [[Threat Modeling]]. Ganha urgência com [[Work in a Folder]]: o agente lê arquivos não confiáveis e tem permissão de escrita.
> - **Economia de tokens** — custo, cache de prompt, orçamento de contexto. Nada no vault sobre isso.
> - **Evals rigorosos** — o vault tem apenas o formato leve; falta o que se faz quando a decisão é cara.
