---
title: Claude Code
aliases:
  - Agentic Coding Tool
tags:
  - ai
  - claude
  - agent
  - software-development
type: concept
status: seed
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
> [!abstract]
> **Claude Code** é a ferramenta de codificação agêntica do Claude: trabalha diretamente num repositório — lendo, escrevendo e modificando código, rodando comandos e testes — a partir de instruções em linguagem natural.

## Conceito

A diferença em relação a um autocompletar de IA é o **escopo da unidade de trabalho**. O autocompletar sugere a próxima linha; o Claude Code recebe uma intenção ("implemente esta funcionalidade", "corrija este bug", "resolva estes conflitos de merge") e executa o ciclo inteiro: entender o codebase, alterar arquivos, rodar comandos, verificar e versionar.

Funciona no terminal, na IDE, no navegador ou acionado a partir do Slack — a premissa é encontrar o desenvolvedor onde ele já está, em vez de exigir troca de interface.

## Onde a execução acontece

| | Local | Cloud |
|---|---|---|
| Arquivos | Pasta na sua máquina | Repositório GitHub conectado |
| Ferramentas | As suas, instaladas localmente | Ambiente provisionado |
| Sessão | Enquanto o app está aberto | Continua mesmo com o app fechado |
| Bom para | Preview local, ferramentas próprias | Codebase grande, refatoração longa, manter o trabalho fora da máquina |

## Níveis de autonomia

O grau de iniciativa é ajustável, e é o principal controle de risco:

- **Manually approve** — propõe cada mudança e espera aprovação
- **Accept edits** — aplica edições de arquivo automaticamente
- **Plan** — elabora um plano antes de mexer em qualquer coisa

## Casos de uso típicos

- Construir funcionalidade descrita em linguagem natural, com testes e commit
- Depurar a partir de mensagem de erro, analisando o codebase para localizar a causa
- Navegar codebase desconhecido — perguntar como as partes se conectam
- Automatizar o tedioso: lint, conflitos de merge, notas de release

## Salvaguardas

Diffs visuais mostram o que mudou, terminal embutido mostra os comandos rodando, e o Git rastreia cada versão — o que torna toda alteração reversível. É a aplicação de [[Human-in-the-Loop]] a um agente com permissão de escrita.

> [!question] Lacuna aberta
> Tratado em visão geral no Claude 101. O curso *Claude Code in Action* cobre em profundidade os fluxos de desenvolvimento, ainda não incorporado a este vault.

## Veja também

- [[Claude Cowork]]
- [[Agentic Workflow]]
- [[Escolha da Forma de Trabalho com IA]]
- [[Software Development and Management]]
- [[Pipeline de CI-CD]]
