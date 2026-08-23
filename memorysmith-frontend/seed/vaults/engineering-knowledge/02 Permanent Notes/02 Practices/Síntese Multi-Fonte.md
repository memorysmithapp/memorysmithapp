---
title: Síntese Multi-Fonte
aliases:
  - Cross-Source Synthesis
  - Briefing Multi-Fonte
  - Síntese Cross-Platform
tags:
  - ai
  - agent
  - workflow
  - research
  - practice
type: practice
status: evergreen
source: Claude Use Cases (Product Cowork) — claude.com/resources/use-cases
author: Anthropic
created: 2026-08-04
---
Técnica para extrair de várias fontes desconexas — pastas locais, mensageria, CRM, tracker, dashboards na web — o padrão que **nenhuma delas mostra sozinha**: temas com contagem por fonte, sinais que atravessam plataformas e reconciliação dos números que discordam entre si.

## Dinâmica / Passo a Passo

1. **Nomeie as fontes explicitamente**, cada uma com seu recorte: a pasta das transcrições, os canais que importam, quais objetos do CRM, quais filas do tracker.
2. **Dê um ponto de partida, não uma lista fechada.** Um documento que cita pessoas, canais e arquivos rende mais que uma enumeração: dele o agente tira os termos de busca e segue as pontas — da pessoa para os canais dela, do canal para o documento citado, do documento para o dado.
3. **Peça contagem por fonte, não total agregado.** `Mobile (57) — Calls 11 · Slack 31 · CRM 1 · Linear 14` diz algo que `57 menções` esconde.
4. **Peça explicitamente os padrões cross-plataforma.** É a leitura que só existe no cruzamento: um tema presente em *todas* as fontes é dor real; um tema de baixo volume mas concentrado em notas de negócio perdido é bloqueador de receita.
5. **Peça citações representativas.** É o que permite verificar o tema por amostragem em vez de confiar na contagem.
6. **Mande reconciliar divergências.** *"Os números de receita provavelmente não batem — descubra qual é o atual."* A resposta deve dizer qual valor foi usado, por quê, e registrar a diferença.
7. **Declare o critério de priorização** — frequência, impacto de negócio, força do sinal — antes de pedir a priorização.

## Regras

- **Contagem por fonte separa "muita gente" de "muitas plataformas".** Trinta menções num canal barulhento é um grupo vocal; três menções em quatro sistemas diferentes é um padrão.
- **Divergência entre fontes é achado, não ruído.** Dois relatórios com receitas diferentes normalmente indicam corte temporal distinto — isso vira uma linha no apêndice, não um erro a esconder.
- **Peça argumento, não resumo.** *"Make an argument, not a summary"*: a síntese útil termina numa tese defensável com a evidência anexada, não numa lista de tudo que foi dito.
- **Verifique a fonte antes do achado.** O painel de contexto mostra o que está sendo lido; fonte retornando menos que o esperado invalida a contagem. Ver [[Observabilidade de Sessão Agêntica]].
- **Paralelize as consultas independentes.** Puxar de quatro sistemas que não dependem entre si é trabalho para [[Agentes Paralelos|subagentes]] simultâneos.

## Exemplo

*"Encontre os temas principais entre transcrições de call na pasta, `#customer-feedback` e `#support-questions`, notas de oportunidade e motivos de perda no CRM, e as issues abertas no tracker. Dê contagem por fonte, padrões que aparecem em mais de uma plataforma, e citações representativas. Depois priorize em ideias de produto por frequência e impacto de negócio."*

O achado que justifica a técnica não é o tema mais citado — é o tema **de baixo volume que só aparece nas notas de negócio perdido**: invisível em qualquer fonte lida isoladamente, decisivo quando cruzado.

---
Ref: [[Agentic Research]], [[Observabilidade de Sessão Agêntica]], [[Agentes Paralelos]], [[Connector]], [[Claude Cowork]], [[Enterprise Search]], [[Especificação de Entregável]]
