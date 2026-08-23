---
title: Network Functions Virtualization (NFV)
aliases:
  - NFV
  - Virtualização de Funções de Rede
tags:
  - networking
  - virtualization
  - telecom
type: concept
status: seed
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Prática de executar funções de rede — roteador, firewall, proxy, balanceador — como software em servidores padrão, no lugar de appliances dedicados.

## Conceito

Segue exatamente o roteiro da virtualização de servidor, uma década depois e no domínio de rede. A indústria de telecomunicações foi a primeira a enxergar a oportunidade: rodar serviços de rede de borda em máquinas commodity em vez de equipamento especializado.

O ganho é o mesmo da virtualização de servidor — elasticidade, custo, velocidade de provisionamento. O custo também: **overhead de performance**.

## Características

- Funções típicas virtualizadas: roteadores, proxies, load balancers, firewalls, gateways de sessão.
- É a categoria de workload que mais exige atenção no dimensionamento de hardware — o próprio livro-fonte a classifica como "devoradora de performance".
- Frequentemente demanda otimizações de baixo nível: SR-IOV, DPDK, pinning de CPU, NUMA — que aparecem no [[Placement]] como resource classes (`SRIOV_NET_VF`, `NUMA_CORE`) e traits.

## Veja também

- [[Software-Defined Networking (SDN)]]
- [[Capacity Planning]]
- [[Placement]]
- [[Neutron]]
