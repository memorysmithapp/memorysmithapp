---
title: Rally
aliases:
  - OpenStack Rally
  - Rally Benchmarking
tags:
  - openstack
  - benchmarking
  - performance
  - testing
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Ferramenta de [[Benchmarking]] para OpenStack: submete o control plane a carga sintética controlada e mede se o resultado cumpre o SLA declarado.

## Conceito

Rally não é nativo do ecossistema — instala-se à parte, tipicamente como container. Seu valor é transformar "acho que está lento" em número comparável entre execuções.

O uso mais produtivo não é rodar um cenário isolado, e sim **repetir o mesmo cenário variando um parâmetro de configuração** e comparar os relatórios. É assim que se identifica onde o tempo é gasto.

## Estrutura

Um cenário é uma **task**, escrita em YAML ou JSON:

```yaml
ScenarioClass.scenario_method:
  - args:      # parâmetros do método
    runner:    # frequência e ordem da carga
    context:   # tenants, usuários, quotas, papéis
    sla:       # critérios de sucesso
```

**Runners:**

| Tipo | Comportamento |
|---|---|
| `constant` | Número fixo de execuções |
| `constant_for_duration` | Número fixo até um instante |
| `periodic` | Período definido entre cenários consecutivos |
| `serial` | Número fixo numa única thread |

**Condições de SLA:** `max_avg_duration`, `max_seconds_per_iteration`, `failure_rate.max`, `performance_degradation.max_degradation`, `outliers.max`.

## Características

O relatório HTML traz dois gráficos que carregam a análise:

- **Load Profile** — quantas iterações rodaram em paralelo ao longo do tempo. Revela o teto real de concorrência suportado.
- **Atomic Action Durations** — duração por ação primitiva do cenário. É onde o gargalo aparece nominalmente.

> [!warning] `--abort-on-sla-failure` não é opcional em produção
> Rally gera carga pesada de propósito. Sem a flag, um benchmark contra ambiente real vira incidente.

## Veja também

- [[Benchmarking]]
- [[OSProfiler]]
- [[Service Level Agreement (SLA)]]
