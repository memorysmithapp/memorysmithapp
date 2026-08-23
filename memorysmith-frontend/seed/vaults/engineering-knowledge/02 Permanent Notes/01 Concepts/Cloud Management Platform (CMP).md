---
title: Cloud Management Platform (CMP)
aliases:
  - CMP
  - Plataforma de Gestão de Nuvem
tags:
  - cloud
  - hybrid-cloud
  - governance
  - operations
type: concept
status: seed
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Camada de administração unificada que centraliza o provisionamento, a operação e a governança de recursos espalhados por nuvens pública, privada e on-premises.

## Conceito

Num arranjo [[Hybrid Cloud|híbrido]], cada ambiente traz seu próprio console, sua própria CLI e seu próprio modelo de permissão. O CMP existe para que a operação não se fragmente na mesma medida que a infraestrutura.

O que ele **não** precisa ser: uma reimplementação das APIs de cada provedor. O que ele **precisa** ser: um painel com capacidade de **proxy**, capaz de rotear requisições ao endpoint certo.

## Características

- Fortalecido por ferramentas de orquestração que operam entre ambientes.
- Entrega **catálogo de serviços** e **blueprints reutilizáveis**, permitindo provisionar com o máximo de automação em qualquer endpoint conectado.
- Consolida o que os provedores não consolidam entre si: visão de custo, inventário e política de acesso.

Fornecedores de mercado: Flexera, CloudBolt, OVHcloud, Nutanix. Muitas organizações constroem o próprio.

## Veja também

- [[Hybrid Cloud]]
- [[Multi-Cloud]]
- [[Governance]]
- [[FinOps]]
