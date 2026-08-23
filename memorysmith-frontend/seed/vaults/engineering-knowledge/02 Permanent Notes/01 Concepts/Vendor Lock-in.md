---
title: Vendor Lock-in
aliases:
  - Lock-in
  - Aprisionamento Tecnológico
tags:
  - cloud
  - architecture
  - cloud-strategy
  - risk
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Situação em que o custo de trocar de fornecedor se torna alto o bastante para que a decisão deixe de ser livre.

## Conceito

Lock-in não é binário nem sempre indesejável — usar um serviço gerenciado é aceitar alguma dependência em troca de velocidade. O problema começa quando a dependência é **acumulada sem intenção** e descoberta tarde.

Assume duas formas distintas em nuvem:

| Forma | Onde mora | Mitigação |
|---|---|---|
| **Do workload** | Dependências do provedor dentro da aplicação | Containerização, microsserviços, abstração de serviço |
| **Da gestão de infraestrutura** | Templates de IaC específicos: CloudFormation, Azure Deployment Manager, Cloud Deployment Manager, Heat | Ferramentas agnósticas: Terraform, Pulumi |

A segunda é a mais silenciosa. Escrever templates CloudFormation não parece uma decisão estratégica no dia em que se escreve — mas eles não servem em GCP nem em Azure.

## Características

Mover um workload entre provedores tipicamente exige: planejar, construir conexão privada entre origem e destino, gerar o artefato, implantar no alvo e testar. O tempo disso é a medida real do lock-in.

**Container reduziu drasticamente esse custo.** Padronizou o artefato de deploy a ponto de mover entre ambientes virar, em muitos casos, uma questão de conectar um registry compartilhado.

> [!tip] Custo de saída é decisão de arquitetura, não de contrato
> Ser livre de lock-in **depois** é caro. A questão a fazer no dia do desenho é: qual o custo de sair daqui em dois anos?

## Veja também

- [[Multi-Cloud]]
- [[Hybrid Cloud]]
- [[Infrastructure as Code]]
- [[Container]]
- [[Arquitetura Evolutiva]]
