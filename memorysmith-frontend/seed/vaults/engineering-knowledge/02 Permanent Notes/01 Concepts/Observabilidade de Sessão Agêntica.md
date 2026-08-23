---
title: Observabilidade de Sessão Agêntica
aliases:
  - Progress Panel
  - Painel de Progresso
  - Observabilidade de Agente
tags:
  - ai
  - agent
  - workflow
  - observability
type: concept
status: evergreen
source: Claude Use Cases (Product Cowork) — claude.com/resources/use-cases
author: Anthropic
created: 2026-08-04
---
> [!abstract]
> **Observabilidade de sessão agêntica** é o conjunto de superfícies que mostram, durante a execução, o que o agente está lendo, o que já produziu e em que ponto do plano está — para que a correção seja possível **enquanto** o trabalho corre, e não só no fim.

## Conceito

Delegar um trabalho longo cria o mesmo problema de qualquer processo assíncrono: entre o disparo e o resultado existe uma janela cega. Se a única evidência é o entregável final, todo erro custa a execução inteira.

A resposta é a mesma que a de sistemas distribuídos — instrumentar o processo. No [[Claude Cowork]] isso aparece em três painéis com papéis distintos, que juntos respondem *onde estou*, *de onde veio* e *o que já existe*:

| Painel | Responde | Para que serve |
|---|---|---|
| **Progresso / plano** | Em que passo o agente está | Ver o gargalo — qual conector está lento, qual etapa travou |
| **Contexto** | Quais fontes e arquivos estão sendo lidos | Detectar fonte errada, ausente ou retornando menos que o esperado |
| **Artifacts** | Quais arquivos já foram criados | Ver o entregável se formando antes de terminar |

O ganho não é conforto: é a possibilidade de **conduzir no meio**. Se o Slack está retornando pouco, você ajusta o recorte sem esperar o fim; se o agente abriu a pasta errada, você corrige antes de duzentos arquivos serem processados.

## Características

- **Contínua** — atualiza durante a execução, não ao final
- **Rastreável até a fonte** — mostra *de onde* veio cada dado, o que é o que permite auditar o achado
- **Conduzível** — a sessão aceita correção em andamento, sem reinício
- **Assíncrona** — a sessão sinaliza quando precisa de você (no Cowork, um ponto cinza na barra lateral), o que libera atenção para outra sessão em paralelo

> [!tip] Uma sessão longa não bloqueia você
> Enquanto uma tarefa demorada roda — organizar a área de trabalho, auditar 200 ativos, reconciliar um mês —, abra outra sessão para o próximo trabalho. O paralelismo aqui é de **sessões**, não de [[Agentes Paralelos|subagentes]]: são trabalhos independentes seus, não decomposições de um mesmo trabalho.

> [!important] Observabilidade é o que torna a delegação revisável
> Sem ela, [[Human-in-the-Loop]] degrada para aprovação cega no fim. É o mesmo argumento de [[Observability]] em produção: o valor não está no log, está na pergunta que ele permite fazer enquanto ainda dá tempo.

## Veja também

- [[Plano Revisável]]
- [[Claude Cowork]]
- [[Agentic Workflow]]
- [[Human-in-the-Loop]]
- [[Agentes Paralelos]]
- [[Observability]]
