---
title: Criação de Skill por Conversa
aliases:
  - Custom Skill Authoring
tags:
  - ai
  - agent
  - workflow
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Procedimento para criar uma [[Agent Skill]] customizada sem escrever código, entrevistando-se com o próprio assistente até que ele gere a estrutura de arquivos.

## Dinâmica / Passo a Passo

1. **Declare a intenção.** Numa conversa nova: *"quero criar uma skill para escrever revisões trimestrais de negócio"* ou *"preciso de uma skill que aplique nossas diretrizes de marca a apresentações"*.
2. **Responda à entrevista.** O assistente pergunta o que a skill deve fazer, o que caracteriza uma boa saída para esse tipo de trabalho, e em que situações ela se aplica. As respostas são a matéria-prima.
3. **Suba material de referência.** Templates, guias de estilo, ativos de marca, exemplos de trabalho que você considera bom. É o que traduz "boa saída" de adjetivo em critério.
4. **Salve.** O assistente gera o arquivo estruturado; você salva e a skill entra na lista, ao lado das nativas.
5. **Itere pelo uso.** Peça ao assistente para editar a skill quando o resultado destoar — ele atualiza os arquivos.

## Regras

- **Skill codifica processo, não conhecimento.** Se o que você quer é que o assistente *saiba* de algo, o lugar é um [[Project Workspace|projeto]]. Se é que ele *faça* de um jeito específico, é skill.
- **O gatilho deve ser descritível.** Uma skill é invocada por relevância; se você não consegue descrever quando ela se aplica, o assistente também não vai reconhecer.
- **Exemplo vale mais que adjetivo.** "Formal e conciso" é ambíguo; dois documentos que você considera exemplares não são.
- **Só instale skill de fonte confiável.** Skill contém código executável. Vinda de fora, revise antes de usar.
- **Skills customizadas são privadas à sua conta**, salvo distribuição explícita.

## Candidatos a skill

| Bom candidato | Mau candidato |
|---|---|
| Metodologia de análise de variação trimestral | Uma pergunta que você faz uma vez |
| Revisão de tom de marca | Material de referência estático (isso é projeto) |
| Checklist de compliance | Preferência geral de estilo (isso é *style*) |
| Estruturação de notas de reunião num formato fixo | Tarefa cujo passo a passo muda sempre |

---
Ref: [[Agent Skill]], [[Project Workspace]], [[Plugin (AI Agent)]], [[Configuração de Projeto de IA]], [[Claude 101 02]]
