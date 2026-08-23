---
title: Border Gateway Protocol (BGP)
aliases:
  - BGP
  - Roteamento Dinâmico
tags:
  - networking
  - routing
  - protocol
type: concept
status: seed
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Protocolo de roteamento que troca informações de alcançabilidade entre sistemas autônomos — na prática, o protocolo que faz a internet funcionar.

## Conceito

O BGP anuncia **prefixos de rede** a peers. Cada roteador aprende quais redes existem, por onde alcançá-las e a que custo, e propaga isso adiante.

Em nuvem, o valor é específico: permite que redes internas se **anunciem sozinhas** à infraestrutura de rede física, sem que um administrador configure rotas manualmente para cada nova rede criada por um tenant.

## Características no contexto de nuvem

- Elimina a necessidade de **[[Floating IP]]** para redes tenant que não dependem de anúncio manual.
- Depende de dois mecanismos de controle de endereçamento para evitar sobreposição de prefixos anunciados: **address scopes** e **subnet pools**.
- Exige **conectividade direta** entre o nó de rede e o gateway físico com o qual fazer peering (LAN ou WAN).
- O construto que faz o peering é o **BGP speaker**; tenant e rede externa precisam estar no mesmo address scope.

> [!info] No OpenStack
> Roteamento dinâmico entrou no [[Neutron]] no release **Mitaka**; o suporte com o mechanism driver [[Open Virtual Network (OVN)]] chegou no **Antelope**. A adoção varia bastante entre ambientes, justamente pelo requisito de conectividade física direta.

## Veja também

- [[Floating IP]]
- [[Neutron]]
- [[NAT]]
- [[Subnet]]
