---
title: Overcommitment
aliases:
  - Overcommit
  - Oversubscription
  - Sobrecomprometimento
tags:
  - virtualization
  - capacity-planning
  - compute
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Técnica de alocar mais recurso virtual do que existe fisicamente no host, apostando que nem todas as cargas pedem o pico simultaneamente.

## Conceito

É estatística aplicada a infraestrutura. Se dez VMs têm 2 vCPU cada mas usam 20% da capacidade em média, dedicar 20 cores físicos é desperdício. A razão de overcommit expressa a aposta: **16:1** significa 16 vCPUs por CPU físico.

O ganho é densidade e custo. O risco é contenção quando a aposta falha.

## Características

**CPU e memória se comportam de formas opostas:**

| | CPU | Memória |
|---|---|---|
| Comportamento sob pressão | Degrada gradualmente — processos esperam escalonamento | Degrada abruptamente — entra swap ou o OOM killer age |
| Razão típica | 16:1 é comum e seguro | 1:1 a 1:1,5 |
| Mitigação | Nenhuma necessária | Swap dimensionado com folga |

> [!warning] Overcommit de memória não perdoa
> Diferente da CPU, comprometer memória em excesso degrada a performance da instância se não houver swap planejado. Com razão 1:1,5, a recomendação é swap com o dobro do provisionado.

## Exemplo

Cálculo de CPU física para 200 VMs, com 2 GHz por VM, cores de 2,6 GHz, overhead de SO de 20% e overcommit 16:1:

```
(200 × 2) ÷ 2,6        = 154 vCPU
154 + 20%              = 185 vCPU
185 ÷ 16               = 12 cores físicos
```

## Veja também

- [[Capacity Planning]]
- [[Hypervisor]]
- [[Flavor]]
- [[Nova]]
