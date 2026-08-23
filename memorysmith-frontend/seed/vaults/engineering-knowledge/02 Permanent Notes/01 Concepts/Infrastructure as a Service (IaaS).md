---
title: Infrastructure as a Service (IaaS)
aliases:
  - IaaS
  - Infraestrutura como Serviço
tags:
  - cloud
  - service-model
  - infrastructure
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Modelo de entrega em que computação, rede e armazenamento são expostos como pools reservados sob demanda, com o consumidor responsável pelo sistema operacional para cima.

## Conceito

É a camada mais baixa dos modelos de serviço de nuvem. O provedor entrega o recurso bruto e o pool; o consumidor decide o que roda nele.

O que define o modelo não é a virtualização — é o **pay-as-you-use** com autosserviço por API. Recursos são reservados sob demanda, com segurança e isolamento, e devolvidos quando não são mais necessários.

## Comparação

Quanto mais à direita, mais camadas sob responsabilidade do provedor:

| Camada                  | On-premises |   IaaS   |   PaaS   |   SaaS   |
| ----------------------- | :---------: | :------: | :------: | :------: |
| Aplicação               |    você     |   você   |   você   | provedor |
| Dados                   |    você     |   você   |   você   | provedor |
| Runtime                 |    você     |   você   | provedor | provedor |
| Middleware              |    você     |   você   | provedor | provedor |
| Sistema operacional     |    você     |   você   | provedor | provedor |
| Virtualização           |    você     | provedor | provedor | provedor |
| Servidor, storage, rede |    você     | provedor | provedor | provedor |

> [!important] Menos gestão significa menos controle
> A troca é simétrica. Move-se para SaaS para reduzir o custo operacional; perde-se, na mesma medida, a capacidade de customizar a camada delegada. Ver [[Shared Responsibility Model]].

## Características

- **Elasticidade** — capacidade acompanha a demanda.
- **Autosserviço** — o consumidor provisiona sem intermediário humano.
- **Medição** — consumo rastreado e faturável por recurso.
- **Isolamento multi-tenant** — ver [[Multi-Tenancy]].

## Veja também

- [[OpenStack]]
- [[Shared Responsibility Model]]
- [[Serverless]]
- [[Hybrid Cloud]]
