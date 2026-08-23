---
title: Claude 101 01
aliases:
  - "Módulo 1: Meet Claude"
tags:
  - ai
  - claude
  - prompting
  - ai-fluency
type: literature
status: evergreen
source: Claude 101 — Anthropic Academy, lições 1–4
author: Anthropic
created: 2026-07-31
---
## Módulo 1: Meet Claude

Cobre as quatro primeiras lições: *What is Claude?*, *Your first conversation with Claude*, *Getting better results* e *How you'll work with Claude on your desktop*.

## Resumo executivo

O módulo estabelece o enquadramento do curso inteiro: o Claude não é um chatbot de pergunta-e-resposta, é um **parceiro de raciocínio**. Ensina a escrever prompts em três camadas, a diagnosticar respostas ruins e — na quarta lição, a mais recente e a mais estrutural — a reconhecer qual das **três formas de trabalho** uma tarefa pede antes de começá-la.

## Principais ideias

### O Claude é guiado por princípios, não só por dados

O treinamento segue [[Constitutional AI]]: o modelo é alinhado a um conjunto explícito de princípios para ser *helpful, harmless and honest*. A consequência prática é ser **steerable** — aceita direção sobre personalidade, tom e comportamento com menos esforço de prompt.

### Fale com o Claude como você falaria com um colega

Naturalmente, concisamente, conversacionalmente. O curso é explícito: o erro do iniciante é digitar como quem digita numa caixa de busca.

### O prompt tem três camadas

A base de [[Prompt em Três Camadas]] — **setting the stage** (papel, objetivo, contexto), **defining the task** (a ação) e **specifying rules** (estilo, tom, formato, exemplos). O framework é adaptado do 4D Framework de [[AI Fluency]], na competência *Description*.

### A primeira resposta é o começo, não o fim

A conversa é iterativa por desenho. O curso trata os defeitos comuns (resposta genérica, tamanho errado, formato ignorado, alucinação, tom errado) como sintomas com causa e antídoto conhecidos — o conteúdo de [[Iteração sobre a Resposta da IA]].

### Contexto vem de fora do prompt também

Uploads de arquivo, [[Connector|conectores]], preferências pessoais, [[Agent Memory|memória]] e *styles*. A [[Context Window|janela de contexto]] de 200K+ tokens (até 1M em planos superiores) é o que torna viável jogar um dossiê inteiro dentro de uma conversa.

### Três formas de trabalho, não três produtos

A lição 4 é a chave de leitura do curso:

| Você vai… | Forma | Onde vive hoje |
|---|---|---|
| Perguntar, rascunhar, pensar junto, turno a turno | Trabalho conversacional | Chat |
| Entregar uma tarefa multi-etapa que termina num arquivo real, cruza ferramentas ou roda em agenda | [[Agentic Workflow\|Trabalho delegado]] | [[Claude Cowork]] |
| Escrever, testar e entregar código num repositório | Construção de software | [[Claude Code]] (aba Code) |

> [!important] A escolha não é de aba, é de forma
> Você não escolhe a ferramenta primeiro. Você percebe que **tipo** de trabalho está na sua frente, e a ferramenta decorre disso. Ver [[Escolha da Forma de Trabalho com IA]].

## Conceitos apresentados

- [[Constitutional AI]] — o alinhamento por princípios explícitos
- [[Context Window]] — o limite de material que cabe numa conversa
- [[Extended Thinking]] — raciocinar antes de responder
- [[Agent Memory]] — contexto que sobrevive à conversa
- [[AI Fluency]] — as quatro competências (4D)
- [[Eval]] — medir se a IA serve para *o seu* trabalho
- [[Agentic Workflow]] — delegar o resultado, não a pergunta
- [[Claude Cowork]] · [[Claude Code]] — as superfícies das formas 2 e 3
- [[Scheduled Task]] · [[Computer Use]] · [[Plugin (AI Agent)]]

## Exemplos

Prompt canônico do curso, com as três camadas visíveis:

> "I'm the marketing lead at an indie streaming startup, and we're preparing an investor pitch deck for Series A investors. *(palco)* Can you research the current state of the independent film streaming market and identify key trends, competitor positioning, and growth opportunities? *(tarefa)* Use current web research with citations and structure it as a professional report of up to 5 pages, with an executive summary, market analysis, competitive landscape, and growth opportunities. *(regras)*"

---
Ref: [[Prompt em Três Camadas]], [[Iteração sobre a Resposta da IA]], [[Eval Leve de Tarefas com IA]], [[Escolha da Forma de Trabalho com IA]], [[Claude 101]]
