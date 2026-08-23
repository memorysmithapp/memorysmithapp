---
title: Claude 101 02
aliases:
  - "Módulo 2: Organizando trabalho e conhecimento"
tags:
  - ai
  - claude
  - knowledge-management
  - workflow
type: literature
status: evergreen
source: Claude 101 — Anthropic Academy, lições 5–7
author: Anthropic
created: 2026-07-31
---
## Módulo 2: Organizando trabalho e conhecimento

Cobre as lições *Introduction to projects*, *Creating with artifacts* e *Working with skills*.

## Resumo executivo

Se o módulo 1 trata da conversa isolada, este trata do que **persiste entre conversas**. Três mecanismos, com papéis distintos e complementares: o Projeto guarda **conhecimento**, a Skill codifica **processo**, e o Artifact é o **produto** que sai da conversa em forma reutilizável.

> [!important] A distinção que o curso faz questão de cravar
> *Projects store knowledge, skills perform tasks.* O projeto fornece o **o quê** (informação); a skill fornece o **como** (procedimento).

## Principais ideias

### Projeto é workspace, não pasta

Um [[Project Workspace]] tem memória própria, histórico de conversas próprio, base de conhecimento própria e instruções próprias. Ele existe para trabalho **contínuo**, não para pergunta avulsa — o gatilho é: existe material de referência que você reenviaria toda vez?

### O projeto escala sozinho via RAG

Quando a base de conhecimento se aproxima do limite da [[Context Window]], o Claude para de carregar tudo e passa a **buscar** dentro dos arquivos, trazendo só o relevante. É [[Retrieval-Augmented Generation (RAG)]] aplicado ao workspace, e amplia a capacidade em até 10×. O nome dos arquivos importa: o Claude usa o nome para decidir onde buscar.

### As instruções do projeto são programação de comportamento

Contexto do trabalho, instruções de processo, preferências de tom e requisitos fixos. O curso vai além e sugere usar instruções como **gatilho de automação**: *"quando eu subir uma transcrição de reunião, gere um resumo estruturado neste template."*

### Artifact é saída autônoma, não bloco de texto no chat

Um [[Artifact]] nasce quando o conteúdo é significativo e autocontido (tipicamente > 15 linhas), é algo que você vai querer editar, reutilizar ou referenciar depois, e faz sentido **fora** da conversa. Tipos: documentos, código, páginas HTML, SVG, diagramas Mermaid e componentes React interativos.

> [!warning] Documento Office não é Artifact
> `.docx`, `.xlsx`, `.pptx` e PDF vêm por outro caminho — a capacidade de criação de arquivos, que roda sobre [[Agent Skill|Skills]] — e voltam como arquivo para download, não como artifact.

### Skill é pacote de expertise carregado sob demanda

Uma [[Agent Skill]] é uma pasta de instruções, scripts e recursos que o Claude carrega dinamicamente quando a tarefa pede. Duas categorias: **Anthropic Skills** (criação de documentos, mantidas pela Anthropic) e **Custom Skills** (as suas, para fluxos repetíveis — uma metodologia de análise de variação trimestral, uma revisão de tom de marca, um checklist de compliance).

### A skill se cria conversando

Não se escreve código: descreve-se o fluxo, responde-se às perguntas do Claude, sobem-se templates e exemplos, e o Claude gera a estrutura. Ver [[Criação de Skill por Conversa]].

> [!warning] Skill executa código
> Só instale skills de fonte confiável. Se veio de fora, revise o conteúdo antes de usar. A mesma cautela vale para [[Connector|conectores]] customizados.

## Conceitos apresentados

- [[Project Workspace]] — o workspace com conhecimento, instruções e memória
- [[Artifact]] — saída autônoma e reutilizável
- [[Agent Skill]] — pacote procedural carregado dinamicamente
- [[Retrieval-Augmented Generation (RAG)]] — como o projeto escala além da janela

## Exemplos

Projetos sugeridos pelo curso: lançamento de produto (specs + análise competitiva + notas de messaging), hub de conta de cliente (brand guidelines + entregas passadas + histórico), workspace de evento (contratos de venue + bios + dados de participantes).

Prompts que disparam Skills automaticamente: *"Create an Excel spreadsheet tracking monthly expenses with formulas for totals"*, *"Turn this meeting notes document into a PowerPoint presentation"*.

---
Ref: [[Configuração de Projeto de IA]], [[Criação de Skill por Conversa]], [[Claude 101]]
