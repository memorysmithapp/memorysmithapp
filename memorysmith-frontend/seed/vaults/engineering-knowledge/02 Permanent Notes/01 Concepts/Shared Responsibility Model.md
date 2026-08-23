---
title: Shared Responsibility Model
aliases:
  - Modelo de Responsabilidade Compartilhada
  - Segurança da Nuvem e na Nuvem
tags:
  - cloud
  - security
  - compliance
  - governance
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Divisão explícita de deveres entre provedor e consumidor de nuvem: o provedor responde pela segurança **da** nuvem, o consumidor pela segurança **na** nuvem.

## Conceito

A formulação em duas preposições é mais precisa do que parece:

- **Segurança da nuvem** — infraestrutura física, hardware, hipervisor, rede subjacente, conformidade regional. Responsabilidade do provedor.
- **Segurança na nuvem** — sistema operacional convidado, dados, criptografia, identidade, configuração de rede virtual, políticas de acesso. Responsabilidade do consumidor.

A linha entre elas **se move conforme o modelo de serviço**. Em IaaS, o consumidor carrega o SO; em SaaS, quase nada. Ver [[Infrastructure as a Service (IaaS)]].

## Características

- **A divisão varia de serviço para serviço**, não apenas de modelo para modelo. Dois serviços do mesmo provedor podem ter fronteiras diferentes.
- Abrange mais que segurança: **resiliência e disponibilidade** também são compartilhadas, com garantias distintas por serviço.
- Num arranjo [[Hybrid Cloud|híbrido]], o modelo precisa ser **estendido e documentado explicitamente** — cada workload herda um conjunto diferente de fronteiras.

Entidades tipicamente envolvidas na negociação de fronteira: hardware, storage, criptografia, rede física, sistema operacional convidado, segurança de plataforma, localização do dado, autenticação e autorização.

> [!warning] A fronteira não documentada é a que falha
> O erro mais comum não é escolher mal o lado — é assumir que o outro lado cobria algo que ninguém cobria.

## Veja também

- [[Infrastructure as a Service (IaaS)]]
- [[Hybrid Cloud]]
- [[Zero Trust]]
- [[Compliance]]
- [[Governance]]
