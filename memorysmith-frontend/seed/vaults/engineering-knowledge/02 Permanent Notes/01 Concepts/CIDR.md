---
title: CIDR
aliases:
  - Classless Inter-Domain Routing
tags:
  - networking
  - cloud
type: concept
status: evergreen
created: 2026-07-09
---
CIDR (Classless Inter-Domain Routing) é um método para representar intervalos de endereços IP utilizando prefixos.

Exemplo:

```
10.0.0.0/16
```

Significa:

- 16 bits para rede
- 16 bits para hosts

```mermaid
graph LR

Network["10.0"] --> Hosts["0.0 - 255.255"]
```

> [!tip]
> Quanto maior o prefixo, menor a quantidade de endereços disponíveis.

## Exemplos

| CIDR | Hosts |
|------|------:|
| /24 | 256 |
| /25 | 128 |
| /26 | 64 |
| /27 | 32 |

## Utilização

- AWS VPC
- Kubernetes
- Redes corporativas
- VPN

## Veja também

- [[Virtual Private Cloud (VPC)]]
- [[Subnet]]
- [[Modelo OSI]]
- [[Kubernetes (K8s)]]
- [[System Design MOC]]