---
title: Enterprise Search
aliases:
  - Busca Corporativa
  - Ask Your Org
tags:
  - ai
  - knowledge-management
  - enterprise
  - search
type: concept
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> **Enterprise Search** é um ponto único de consulta em linguagem natural ao conhecimento disperso pelas ferramentas de uma organização — documentos, chat, e-mail, wikis — com síntese e citação de fonte.

## Conceito

O conhecimento de uma organização não vive num lugar: mora em threads do Slack, anexos de e-mail, documentos no Drive ou SharePoint, páginas de wiki e atas de reunião. A pergunta *"qual é a nossa política de trabalho remoto?"* tem resposta, mas ninguém sabe **onde**.

Enterprise Search é, na prática, um [[Project Workspace]] pré-montado para a organização inteira: a base de conhecimento já é o conjunto das ferramentas conectadas, e as instruções são otimizadas para **busca e síntese**, não para produção. É isso que o diferencia de um chat comum com [[Connector|conectores]] ligados — o mesmo acesso, um propósito estreitado.

## Perguntas que ele responde bem

| Categoria | Exemplos |
|---|---|
| Retomar o fio | "O que aconteceu enquanto eu estava fora?" · "Resuma as atualizações da semana" |
| Política e processo | "Qual é a política de trabalho remoto?" · "Como submeto um relatório de despesas?" |
| Pesquisa interna | "Por que os clientes citam ao escolher concorrentes?" · "Resuma as discussões do roadmap" |
| Onboarding | "Como funciona nosso sistema de autenticação?" · "Com quem falo sobre billing?" |
| Rastreio de projeto | "Quais foram as decisões da reunião de liderança?" |

## Modelo de permissão

O ponto crítico de adoção: **Enterprise Search só mostra o que você já tem permissão de acessar** na ferramenta de origem. Ele não cria um índice paralelo com privilégio elevado — a autorização é herdada por fonte, consulta a consulta. As conversas permanecem privadas e os dados conectados não são indexados nem armazenados separadamente.

## Setup em duas camadas

1. **Administrador** conecta as ferramentas da organização — uma de documentos e uma de chat são obrigatórias, e-mail é recomendado — e nomeia o espaço.
2. **Cada pessoa** autentica com as próprias credenciais em cada serviço. Quanto mais fontes autenticadas, mais completa a busca *daquela pessoa*.

> [!important] Enterprise Search × Research
> [[Agentic Research|Research]] investiga o mundo, principalmente a web pública, de forma multi-etapa e demorada. Enterprise Search consulta o **interior** da organização e responde rápido. A pergunta que decide: a resposta está dentro ou fora da empresa?

## Comparação

| | Enterprise Search | Chat com conectores | [[Project Workspace]] |
|---|---|---|---|
| Escopo | Todas as fontes da organização | As fontes que você ligou | Os arquivos daquele projeto |
| Propósito | Buscar e sintetizar | Qualquer tarefa | Trabalho contínuo num tema |
| Instruções | Otimizadas para busca, pré-configuradas | As suas | As suas |
| Citação | Sempre | Depende do pedido | Depende do pedido |

## Veja também

- [[Connector]]
- [[Project Workspace]]
- [[Agentic Research]]
- [[Knowledge Management]]
- [[Retrieval-Augmented Generation (RAG)]]
