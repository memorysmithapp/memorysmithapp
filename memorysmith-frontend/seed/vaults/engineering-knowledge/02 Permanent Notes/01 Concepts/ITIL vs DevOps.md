---
title: ITIL vs DevOps
aliases:
  - ITIL e DevOps
tags:
  - itil
  - devops
  - comparison
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> ITIL e DevOps não competem: o DevOps otimiza o fluxo de mudança de ponta a ponta; o ITIL governa o ciclo de vida completo de produtos e serviços, incluindo o que o DevOps não endereça.

## Comparação

| | ITIL | DevOps |
|---|---|---|
| Natureza | Framework de gestão | Cultura + práticas de engenharia |
| Escopo | Ciclo de vida completo, portfólio, fornecedor, financeiro | Fluxo do commit à produção |
| Origem | Governança de serviços de TI | Movimento de engenharia |
| Sobre mudança | Autorizar por risco ([[Change Enablement]]) | Automatizar e reduzir lote |
| Ponto forte | Cobertura e vocabulário comum | Velocidade e responsabilidade compartilhada |
| Ponto cego | Vira burocracia quando aplicado uniformemente | Não cobre fornecedor, portfólio nem financeiro |

## Onde há atrito real

O conflito não é entre os frameworks, é entre **controle uniforme** e **controle proporcional ao risco**. Uma implementação de ITIL que exige o mesmo comitê de aprovação para uma mudança de texto e para uma migração de banco é incompatível com DevOps — e também é uma má implementação de ITIL, já que [[Change Enablement]] prescreve classificação por risco.

## Onde se somam

O ITIL 5 dedica seção explícita a *ITIL with DevOps*. Na prática: DevOps fornece o mecanismo para [[Build (Lifecycle)]], [[Transition (Lifecycle)]] e parte de [[Operate (Lifecycle)]]; o ITIL fornece o resto do ciclo e a linguagem comum com o negócio.

## Veja também

- [[DevOps]]
- [[Change Enablement]]
- [[DORA Metrics]]
- [[ITIL vs SRE]]
