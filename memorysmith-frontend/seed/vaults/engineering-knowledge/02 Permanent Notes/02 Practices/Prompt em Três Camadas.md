---
title: Prompt em Três Camadas
aliases:
  - Setting the Stage - Defining the Task - Specifying Rules
  - Estrutura de Prompt
tags:
  - ai
  - prompting
  - ai-fluency
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Técnica para estruturar um pedido a um assistente de IA em três camadas explícitas, produzindo respostas mais úteis sem exigir extensão. Deriva da competência **Description** de [[AI Fluency]].

## Dinâmica / Passo a Passo

1. **Montar o palco** — declare seu papel, seu objetivo e o contexto que o assistente não teria como saber. *Quem está pedindo, para quê, dentro de qual situação.*
2. **Definir a tarefa** — nomeie a ação concreta esperada, com os detalhes que delimitam o escopo. *Escrever, analisar, comparar, construir — o quê exatamente.*
3. **Especificar as regras** — formato, extensão, tom, estrutura de seções, e exemplos quando houver. *Como a saída deve se parecer.*

## Regras

- **Fale como falaria com um colega.** Naturalmente, concisamente, conversacionalmente. O erro típico do iniciante é escrever como quem digita numa caixa de busca.
- **Contexto é a camada mais esquecida e a mais decisiva.** Resposta genérica é quase sempre falta de palco, não falta de instrução.
- **Mostre em vez de descrever, quando o formato importa.** Um exemplo da estrutura desejada vale mais que um parágrafo descrevendo-a.
- **Explicite a extensão.** Sem isso o assistente chuta — "dois parágrafos", "menos de 100 palavras", "análise completa, extensão não é problema".
- **Uma camada pode ser omitida quando é óbvia**, mas omitir por preguiça é a causa mais comum de retrabalho.

## Exemplo

> "Sou líder de marketing numa startup de streaming independente e estamos preparando um pitch deck para investidores Série A. **(palco)** Pesquise o estado atual do mercado de streaming de filmes independentes e identifique tendências, posicionamento dos concorrentes e oportunidades de crescimento. **(tarefa)** Use pesquisa web atual com citações e estruture como um relatório profissional de até 5 páginas, com sumário executivo, análise de mercado, cenário competitivo e oportunidades. **(regras)**"

## Onde as camadas persistem

As três camadas não precisam morar no prompt toda vez. Instruções de [[Project Workspace|projeto]] e [[Agent Memory|memória]] fixam o palco; uma [[Agent Skill|skill]] fixa a tarefa e as regras. Sobra, no prompt, apenas o que varia.

---
Ref: [[AI Fluency]], [[Iteração sobre a Resposta da IA]], [[Project Workspace]], [[Agent Memory]], [[Claude 101 01]]
