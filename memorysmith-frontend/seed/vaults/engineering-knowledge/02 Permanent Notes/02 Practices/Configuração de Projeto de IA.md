---
title: Configuração de Projeto de IA
aliases:
  - Setup de Project Workspace
tags:
  - ai
  - knowledge-management
  - workflow
  - practice
type: practice
status: growing
source: Claude 101 — Anthropic Academy
author: Anthropic
created: 2026-07-31
---
Procedimento para montar um [[Project Workspace]] que elimine o reenvio de contexto e produza respostas consistentes ao longo de um fluxo de trabalho contínuo.

## Dinâmica / Passo a Passo

1. **Decida se cabe um projeto.** O gatilho é recorrência: material que você reenviaria, requisitos de resposta que você repetiria, ou pessoas que precisam da mesma base. Pergunta avulsa não vira projeto.
2. **Nomeie e descreva.** Nome descritivo do fluxo ("Campanha Q4", "Documentação de Produto"). A descrição orienta você e o time, mesmo quando o assistente não a lê.
3. **Escreva as instruções**, cobrindo quatro coisas:
   - **Contexto** do trabalho — "este projeto é para conteúdo de marketing do nosso produto B2B"
   - **Processo** — "primeiro proponha uma estrutura de blog para este público, depois escreva"
   - **Tom e estilo** — "profissional mas conversacional; evite jargão"
   - **Requisitos fixos** — "sempre inclua uma chamada para ação ao final"
4. **Monte a base de conhecimento.** Suba documentos de referência (guias de marca, templates), material de fundo (pesquisas, atas, requisitos), exemplos do que você quer emular, e especificações técnicas.
5. **Defina visibilidade e permissões** quando houver time: *view* (lê e conversa), *edit* (altera instruções, conhecimento e membros), *owner* (controla tudo, inclusive quem vê).
6. **Teste com uma pergunta real** e ajuste as instruções pelo que sair.

## Regras

- **Comece focado.** Um projeto por caso de uso específico, não um projeto para tudo. Expandir depois é fácil; separar depois não é.
- **Nomeie arquivos descritivamente.** `Q4-2025-Brand-Guidelines.pdf`, nunca `documento1.pdf` — o nome é usado na recuperação. Agrupe arquivos relacionados.
- **Mantenha a base atual.** Documento obsoleto produz resposta obsoleta com a mesma confiança.
- **Referencie documentos pelo nome ao perguntar.** "Com base no relatório do Q3, quais foram as principais preocupações?" foca a busca.
- **Instruções específicas produzem resultado consistente; instruções vagas, resultado vago.**

## Automação por instrução

As instruções podem funcionar como gatilho de fluxo, não só como preferência:

> "Quando eu subir uma transcrição de reunião, produza um resumo estruturado com: decisões tomadas, pendências com responsável, e riscos levantados."

## Exemplo

**Hub de conta de cliente** — base: brand guidelines do cliente, entregas anteriores, histórico de comunicação. Instruções: adotar o tom do cliente, referenciar o contexto dele ao produzir propostas ou relatórios. Resultado: qualquer conversa dentro do projeto já sai calibrada.

---
Ref: [[Project Workspace]], [[Agent Skill]], [[Retrieval-Augmented Generation (RAG)]], [[Knowledge Management]], [[Claude 101 02]]
