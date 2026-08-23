---
title: Claude Cowork Use Cases 02
aliases:
  - Cowork Use Cases — Síntese Multi-Fonte
tags:
  - ai
  - claude
  - cowork
  - literature
type: literature
status: evergreen
source: claude.com/resources/use-cases — filtro Product = Claude Cowork
author: Anthropic
created: 2026-08-04
---
# 02 — Síntese multi-fonte e pesquisa

Casos 5 a 9: *Build a daily briefing across your tools* · *Surface themes from all your feedback channels* · *Build analysis from browser charts and folder data* · *Size a market using your research* · *Source insights from your tools to build a deck*.

## Resumo executivo

Aqui o insumo deixa de ser uma pasta e passa a ser **um conjunto heterogêneo de sistemas**: pasta local, mensageria, CRM, tracker, dashboards na web via navegador. O que se procura não está em nenhuma fonte isolada — está no cruzamento entre elas.

## Principais ideias

### O achado é o cruzamento, não a contagem

O caso 6 é a demonstração mais limpa. Os temas vêm com contagem **por fonte** (`Mobile 57 — Calls 11 · Slack 31 · CRM 1 · Linear 14`), e a leitura relevante vem depois:

- **High Signal** — aparece nas quatro fontes: dor real, não usuários vocais
- **Revenue Signal** — volume baixo no total, mas concentrado em notas de negócio perdido: bloqueador de venda, não problema de uso

Um tema que some na contagem agregada é o que muda a priorização. Ver [[Síntese Multi-Fonte]].

### Fontes discordam, e a divergência é entrega

O caso 9 instrui explicitamente: *"quando encontrar dados, confira contra outras fontes — os números de receita provavelmente não batem. Descubra qual é o atual."* O agente entrega a reconciliação: relatório de finanças no Drive marca $4.2M, o dashboard puxado pelo navegador marca $4.6M, a diferença é a receita fechada depois do corte do relatório — usou $4.6M e registrou a discrepância no apêndice.

### Dar um ponto de partida vale mais que dar uma lista

Também do caso 9: *"aponte para um recurso inicial e diga para seguir o que encontrar."* Um tracker de projeto que **nomeia pessoas, canais e documentos** rende os termos de busca; a partir dele o agente segue da pessoa para os canais dela, do canal para o documento citado, do documento para o dado. É [[Agentic Research]] operando sobre ferramentas internas.

### Peça argumento, não resumo

O prompt do caso 9 termina com *"Make an argument, not a summary"*, e a saída obedece — o trimestre condensado numa tese: *"a consolidação cortou 22% do custo de engenharia e trouxe a parceria, mas o atrito de migração custou duas contas enterprise — e os dados de retenção mostram que isso é problema de execução, não de produto."*

### O plano é o ponto de revisão

Repetido em quase todos: *"depois do prompt inicial, o Claude pode fazer perguntas — foco de mercado, escopo geográfico, horizonte de tempo, premissas existentes — e então monta um plano que você revisa na barra lateral."* O caso 8 é explícito sobre o porquê: *"confira se ele está cobrindo os segmentos, geografias e frameworks certos antes de começar a puxar dados."* Ver [[Plano Revisável]].

### Paralelismo em dois níveis

- **Subagentes** — *"peça ao Claude para abrir subagentes para consultar Slack, Linear e Salesforce simultaneamente"* (caso 6). Ver [[Agentes Paralelos]].
- **Sessões** — *"comece outra tarefa enquanto esta roda; o ponto cinza na barra lateral avisa quando ela precisa de você"* (casos 5, 7, 8, 9). Ver [[Observabilidade de Sessão Agêntica]].

### O navegador lê o número, não o rótulo

Caso 7: *"quando você aponta o Cowork para um gráfico no navegador, ele extrai os números por trás, não só o que está rotulado. Funciona em dashboards, relatórios e ferramentas de dados que não oferecem exportação fácil."* É a ponte entre [[Computer Use]] e o dado interno da pasta.

## Conceitos apresentados

- [[Síntese Multi-Fonte]] — a prática destilada
- [[Plano Revisável]] — perguntas antecipadas e plano na barra lateral
- [[Observabilidade de Sessão Agêntica]] — painel de progresso, sessões paralelas, condução no meio
- [[Especificação de Entregável]] — `.pptx` + `.xlsx` + `.md` com citações, coordenados (caso 8)
- [[Da Conversa à Skill e ao Agendamento]] — o caso 9 fecha propondo empacotar o deck trimestral como plugin

## Exemplos

> [!quote] Caso 8 — triangulação
> *"Cruze os cálculos bottom-up com relatórios de analistas. O Claude traz o dado; você decide o que ele significa."*

> [!quote] Caso 9 — stress-test da própria narrativa
> *"Você viu todos os dados brutos. Faça o advogado do diabo: quais são as três perguntas mais difíceis que o conselho poderia fazer, e onde nossa narrativa está mais fraca?"*

---
Ref: [[Claude Cowork Use Cases]], [[Síntese Multi-Fonte]], [[Agentic Research]], [[Agentes Paralelos]], [[Claude Cowork]]
