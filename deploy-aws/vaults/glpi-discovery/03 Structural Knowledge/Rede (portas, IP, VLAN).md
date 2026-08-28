---
title: Rede (portas, IP, VLAN)
aliases: [Rede, NetworkPort, IP, VLAN, IPNetwork]
tags: [concept, rede, dominio/ativos]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-1-018 · Rede NetworkPort IPAddress IPNetwork|EV-1-018]]"
author: CAD Discovery
created: 2026-07-10
---

# Rede (portas, IP, VLAN)

Modelo de conectividade que descreve como os ativos se ligam à rede:

- **NetworkPort** — porta de rede de um ativo, com **instanciação por tipo** (ethernet, wifi,
  fibre, aggregate, alias, local, dialup). Guarda MAC e conecta portas entre si.
- **NetworkName / IPAddress** — nomes e endereços IP (IPv4/IPv6) atribuídos à porta.
- **IPNetwork** — **árvore** de sub-redes (CIDR), com relação contém/contido; usada em
  descoberta de rede e organização.
- **Vlan** — VLANs associáveis às portas.
- **Socket** — tomada física / cabeamento estruturado.

Permite mapear a topologia (quais equipamentos estão conectados, em que VLAN, com que IP) e
é fortemente alimentado pelo [[Inventário automático (processo)]] em NetworkEquipment.
