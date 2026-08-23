---
title: Ironic
aliases:
  - OpenStack Bare Metal Service
  - Bare Metal as a Service (BMaaS)
tags:
  - openstack
  - bare-metal
  - provisioning
type: concept
status: seed
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço do OpenStack que provisiona máquinas físicas diretamente, sem camada de hipervisor.

## Conceito

Integrado no release **Kilo**, é a fronteira entre nuvem e hardware. Enquanto o [[Nova]] entrega uma instância virtual sobre um [[Hypervisor]], o Ironic entrega o **metal puro** — com o mesmo modelo de API e de ciclo de vida.

Casos de uso típicos: workloads de [[HPC]] onde a virtualização é custo puro, bancos de dados sensíveis a latência de I/O, e nós de cluster Kubernetes que precisam de acesso direto ao hardware.

> [!question] Nota em estágio inicial
> O livro-fonte menciona o Ironic apenas de passagem, no catálogo de serviços estendidos. Vale aprofundar: ciclo de introspecção de hardware, drivers de gestão (IPMI, Redfish) e o modo `nova-compute-ironic` de integração com o Nova.

## Veja também

- [[Nova]]
- [[Hypervisor]]
- [[OpenStack]]
