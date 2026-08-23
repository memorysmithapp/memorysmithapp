---
title: Eval Leve de Tarefas com IA
aliases:
  - Eval Simples
  - Avaliação Prática de IA
tags:
  - ai
  - evaluation
  - ai-fluency
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Procedimento de baixo custo para descobrir se um assistente de IA serve para uma tarefa **específica do seu trabalho**, comparando a saída dele com trabalho seu já realizado. Materializa o conceito de [[Eval]] e a competência **Discernment** de [[AI Fluency]].

## Dinâmica / Passo a Passo

1. **Reúna exemplos.** De 5 a 10 instâncias de uma tarefa que você faz com regularidade — e-mails que escreveu, relatórios que produziu, análises que fez. O gabarito é trabalho seu, que você sabe defender.
2. **Escreva os prompts de teste.** Redija pedidos que gerariam saídas equivalentes, incluindo o contexto que você naturalmente teria ao fazer o trabalho.
3. **Compare, com três perguntas fixas.**
   - A saída captura a informação essencial?
   - Tom e estilo são adequados?
   - O que falta, ou o que poderia melhorar?
4. **Refine.** Ajuste o prompt, adicione exemplos que mostrem o que é "bom", ou marque explicitamente onde a revisão humana permanece obrigatória.
5. **Reexecute quando algo mudar.** O mesmo conjunto reavalia quando você troca o modelo, o prompt ou a [[Agent Skill|skill]].

## Regras

- **O gabarito é trabalho real.** Exemplo hipotético não revela o que o seu padrão de qualidade exige.
- **Cinco a dez exemplos bastam.** Mais que isso vira projeto e o eval deixa de ser feito.
- **Registre o padrão de falha, não a taxa de acerto.** "Acerta os números mas perde o padrão geral" é acionável; "72%" não.
- **Rode antes de escalar um uso, não depois.** O eval existe para decidir se vale automatizar.
- **Nem toda falha vira prompt.** Algumas viram "isto exige revisão humana" — e essa também é uma conclusão válida.

## Exemplo

Análise de dados: escolha um dataset que você já analisou manualmente. Peça a análise ao assistente. Compare com o seu original. Um achado típico é que os cálculos batem mas a leitura do padrão geral não aparece — o que se corrige acrescentando ao prompt a pergunta que você faria depois dos números.

---
Ref: [[Eval]], [[AI Fluency]], [[Iteração sobre a Resposta da IA]], [[Service Validation and Testing]], [[Claude 101 01]]
