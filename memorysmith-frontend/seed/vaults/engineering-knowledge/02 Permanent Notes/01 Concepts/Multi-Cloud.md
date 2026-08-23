---
title: Multi-Cloud
aliases:
  - Multinuvem
  - Estratégia Multi-Cloud
tags:
  - cloud
  - cloud-strategy
  - architecture
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Estratégia de usar mais de um provedor de nuvem simultaneamente, seja para evitar dependência de um fornecedor, seja para consumir o melhor serviço de cada um.

## Conceito

A distinção que costuma confundir:

| | Multi-cloud | [[Hybrid Cloud\|Híbrido]] |
|---|---|---|
| Definição | Mais de um provedor | Combinação de público **e** privado |
| Exemplo | AWS + GCP | OpenStack + AWS |
| Relação | Todo híbrido é multi-cloud | Nem todo multi-cloud é híbrido |

## Características

Motivações recorrentes:

- **Evitar [[Vendor Lock-in]]** — manter capacidade de negociação e de saída.
- **Melhor serviço de cada um** — cada provedor lidera em categorias diferentes.
- **Presença geográfica** — cobrir regiões que um só provedor não atende bem.
- **Requisito regulatório** — jurisdições que exigem provedor local.

Custos que a estratégia impõe:

- **Expertise multiplicada** — cada provedor tem seu modelo mental, sua CLI, seu IaC.
- **Rede entre nuvens** — latência, banda e custo de egresso.
- **Governança de identidade e custo** consolidada, que nenhum provedor entrega para o concorrente.

> [!tip] Agnosticismo se projeta na arquitetura
> Ser multi-cloud depois é caro; ser multi-cloud desde o desenho é viável. Microsserviços, containers e IaC agnóstica (Terraform, Pulumi) são o caminho — a alternativa é reescrever templates a cada mudança de provedor.

## Veja também

- [[Hybrid Cloud]]
- [[Vendor Lock-in]]
- [[Infrastructure as Code]]
- [[Microservices]]
