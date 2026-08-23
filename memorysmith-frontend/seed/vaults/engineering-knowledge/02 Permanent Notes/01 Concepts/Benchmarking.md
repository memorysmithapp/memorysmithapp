---
title: Benchmarking
aliases:
  - Benchmark
  - Teste de Carga
tags:
  - performance
  - testing
  - operations
  - capacity-planning
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Prática de submeter um sistema a carga sintética controlada para medir seus limites e comparar o resultado contra um critério declarado.

## Conceito

Monitoramento responde "o que está acontecendo agora". Benchmark responde "**quanto isso aguenta**" — uma pergunta que só se responde provocando a resposta.

A distinção que importa: um dashboard todo verde não impede o usuário de falhar ao provisionar um recurso. Métrica e log detectam o que já quebrou; benchmark revela o que está prestes a quebrar.

O uso mais produtivo não é rodar um cenário isolado, e sim **repetir o mesmo cenário variando um parâmetro** e comparar os resultados. É assim que se transforma "acho que está lento" em evidência.

## Características

- **Pertence ao pipeline, não ao incidente.** A recomendação é um estágio de benchmark no CI/CD a cada mudança, ou um ciclo a cada atualização de software e hardware.
- **Precisa de critério declarado.** Sem SLA definido, o número medido não significa nada.
- **Gera carga real.** Rodar contra produção sem mecanismo de abortar por violação de SLA transforma o teste em incidente.

## Comparação

| Prática | Responde | Método |
|---|---|---|
| [[Observability]] | O que está acontecendo? | Métricas, logs, traces contínuos |
| **Benchmarking** | Quais são os limites? | Carga sintética agregada |
| [[Profiling]] | Onde o tempo é gasto? | Trace de execução individual |
| Otimização | Posso usar menos recurso? | Análise histórica + realocação |

## Veja também

- [[Profiling]]
- [[Rally]]
- [[Service Level Agreement (SLA)]]
- [[Capacity Planning]]
- [[Pipeline de CI-CD]]
