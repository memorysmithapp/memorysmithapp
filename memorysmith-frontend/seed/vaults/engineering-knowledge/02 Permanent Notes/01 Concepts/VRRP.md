---
title: VRRP
aliases:
  - Virtual Router Redundancy Protocol
  - Keepalived
tags:
  - networking
  - high-availability
  - failover
  - protocol
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Protocolo que permite a vários roteadores compartilharem um IP virtual, elegendo um master que responde por ele e comutando automaticamente para um backup quando o master silencia.

## Conceito

Resolve o problema mais banal e mais fatal da rede: **o gateway padrão é ponto único de falha**. O VRRP transforma um endereço em recurso flutuante, disputado por um grupo.

O mecanismo é simples e por isso robusto:

1. Cada roteador do grupo recebe uma **prioridade** (0 a 255; 255 é a mais alta).
2. O de maior prioridade vira **master** e assume o **VIP**.
3. O master **anuncia periodicamente** seu estado e prioridade ao grupo.
4. Se os anúncios param, os backups iniciam nova eleição.

## Características

- O intervalo de anúncio (`advert_int`) define a janela de detecção — e portanto o tempo de failover.
- A implementação de referência no Linux é o **Keepalived**.
- `nopreempt` impede que o master original retome o VIP ao voltar, evitando oscilação.

Configuração típica:

```
vrrp_instance kolla_internal_vip_51 {
    state BACKUP
    nopreempt
    interface br0
    virtual_router_id 51
    priority 40
    advert_int 1
    virtual_ipaddress { 10.0.0.47 dev br0 }
}
```

## Exemplo — OpenStack

Usado em duas camadas distintas:

- **Control plane** — HAProxy + Keepalived em três controllers, disputando o VIP das APIs. Três nós porque o quórum fica trivial de determinar.
- **Roteador virtual do [[Neutron]]** — roteadores HA formam grupos VRRP; cada roteador cria um namespace com Keepalived próprio e uma interface `ha` numa rede reservada, invisível ao usuário.

## Veja também

- [[High Availability]]
- [[Active-Active vs Active-Passive]]
- [[Failover]]
- [[Load Balancer]]
