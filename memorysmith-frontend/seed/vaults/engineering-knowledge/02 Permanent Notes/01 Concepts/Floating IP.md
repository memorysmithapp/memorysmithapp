---
title: Floating IP
aliases:
  - IP Flutuante
  - Elastic IP
tags:
  - networking
  - cloud
  - nat
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Endereço IP público que pode ser associado e dissociado dinamicamente de instâncias, tornando um recurso privado alcançável de fora sem alterar sua configuração de rede.

## Conceito

Por padrão, a instância nasce com um IP privado, invisível fora da rede do tenant. O floating IP é a ponte — e, tecnicamente, é **[[NAT|DNAT]]**: o roteador recebe o pacote na interface externa e o encaminha ao destino conforme a regra configurada.

O tráfego de resposta faz o caminho inverso, com o IP de origem traduzido para o floating IP.

A palavra "flutuante" carrega o valor do conceito: o endereço não pertence à instância. Ele **flutua** entre instâncias, o que permite trocar o backend sem trocar o endereço público — a base de estratégias de deploy azul-verde e de recuperação rápida.

## Comparação

| | Floating IP (DNAT) | SNAT |
|---|---|---|
| Direção | De fora para dentro | De dentro para fora |
| Necessário para | Ser alcançado | Alcançar a internet |
| Associação | Explícita, por instância | Implícita, por roteador |

A mesma instância usa os dois mecanismos, em sentidos opostos.

## Características

- No OpenStack, aparece como endereço **secundário** na interface `qg-` do namespace do roteador virtual.
- Consome endereço de um pool finito — daí o planejamento de capacidade incluir a contagem: instâncias + roteadores + load balancers + margem de reserva.
- A alternativa é a **provider network**, em que a instância usa rede física direta em vez do overlay.
- **BGP dinâmico** elimina a necessidade de floating IP: a rede tenant se anuncia sozinha ao roteador físico. Ver [[Border Gateway Protocol (BGP)]].

## Veja também

- [[NAT]]
- [[Neutron]]
- [[Border Gateway Protocol (BGP)]]
- [[Capacity Planning]]
