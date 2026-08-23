---
title: Escolha da Forma de Trabalho com IA
aliases:
  - Chat vs Cowork vs Code
  - Roteamento de Tarefa para IA
tags:
  - ai
  - workflow
  - ai-fluency
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Procedimento para reconhecer, **antes de começar**, qual forma de trabalho uma tarefa pede — pensar junto turno a turno, delegar o resultado, ou construir software. Materializa a competência **Delegation** de [[AI Fluency]].

## Dinâmica / Passo a Passo

1. **Olhe a tarefa, não a ferramenta.** A pergunta não é "qual aba abro", é "que forma esse trabalho tem".
2. **Aplique os três testes**, na ordem:
   - **A resposta muda a próxima pergunta?** Se você não conseguiria escrever o pedido inteiro agora porque ainda não sabe o suficiente — é turno a turno.
   - **O destino é claro e o caminho é trabalhoso?** Várias etapas em sequência, termina num arquivo real, cruza ferramentas, ou deve rodar em agenda — é hand-off.
   - **É código num repositório?** Escrever, testar, rodar, versionar — é ambiente de desenvolvimento.
3. **Formule o pedido na forma certa.** Turno a turno: a próxima pergunta. Hand-off: **o resultado desejado**, não a primeira pergunta que você faria.
4. **Reveja o plano antes da execução**, quando for hand-off. É o ponto de correção mais barato.

## Regras

- **O sintoma mais comum de erro é alimentar uma tarefa inteira uma pergunta por vez**, por hábito de chat. Se você está fazendo a quarta pergunta de uma sequência que já conhecia, era hand-off.
- **Tarefa curta não vira hand-off.** Montar escopo e plano para uma reescrita de parágrafo é overhead.
- **Delegar não é sair de cena.** Plano visível, execução observável, aprovação nas ações irreversíveis. Ver [[Human-in-the-Loop]].
- **A escolha é reversível.** Um hand-off que veio errado vira conversa de ajuste.

## A tabela de roteamento

| Você vai… | Forma | Onde vive |
|---|---|---|
| Perguntar, brainstormar, rascunhar ou pensar algo turno a turno | Trabalho conversacional | Chat |
| Entregar tarefa multi-etapa que termina em arquivo real, cruza ferramentas ou roda em agenda | [[Agentic Workflow]] | [[Claude Cowork]] |
| Escrever, testar, rodar e entregar código | Construção de software | [[Claude Code]] |

## Exemplo

*"Revise o que decidimos sobre precificação no último trimestre nas atas, no chat do time e no e-mail, e atualize o deck do Q3 com os achados."* — três fontes, várias etapas, entregável real: **hand-off**. O erro seria começar perguntando "o que decidimos sobre precificação?" e conduzir manualmente as outras seis etapas.

---
Ref: [[Agentic Workflow]], [[Claude Cowork]], [[Claude Code]], [[AI Fluency]], [[Scheduled Task]], [[Claude 101 01]]
