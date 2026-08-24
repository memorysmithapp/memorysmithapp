---
title: EV-1-018 · Rede — NetworkPort, IPAddress, IPNetwork
aliases: [EV-1-018]
tags: [evidence, dominio/ativos, rede]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-001 · src/NetworkPort.php L56 · src/IPAddress.php L60 · src/IPNetwork.php L48 · src/Vlan.php · src/Socket.php"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-018 · Rede — NetworkPort, IPAddress, IPNetwork

> [!quote] classes (grep confirmado)
> ```php
> class NetworkPort extends CommonDBChild { ... }             // porta de rede de um ativo
> class IPAddress extends CommonDBChild { ... }               // endereço IP
> class IPNetwork extends CommonImplicitTreeDropdown { ... }  // sub-redes em árvore (CIDR)
> class Vlan extends CommonDBTM { ... }                        // VLAN
> ```

Modelo de conectividade de rede:
- **NetworkPort** — porta física/lógica de um ativo (com instanciação por tipo:
  ethernet, wifi, aggregate…), a que se ligam endereços e VLANs.
- **IPAddress** — endereço IP (IPv4/IPv6) associado a uma NetworkName/porta.
- **IPNetwork** — **árvore** de sub-redes (contém/contido por CIDR), usada para descoberta e
  organização.
- **Vlan** e **Socket** (tomadas físicas / cabeamento) completam o modelo.

## Sustenta
- [[Rede (portas, IP, VLAN)]]
- [[Gestão de Ativos e Configuração (SACM)]]
