---
title: EV-2-c2-001 · Equipamentos de rede (network-equipments.rst)
aliases: [EV-2-c2-001]
tags: [evidence, assets, network, dcim, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/assets/network-equipments.rst · Network equipments (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c2-001 · Equipamentos de rede

> [!quote] modules/assets/network-equipments.rst · "Network equipments"
> "Network equipment represent the hardware that manages, transmits and route network between several other equipments (computers, printers...). A network equipment can be a switch, an Ethernet hub, a router, a firewall or a WiFi access point."
> Suportam templates. "Note that if you modify a field manually, it will be considered locked. This will prevent it from being modified the next time the automatic inventory is uploaded."

> [!quote] Aba "Network device" (informações básicas)
> Campos: Name, Data center position, Location, Technician in charge, Group in charge, Alternate username number, Alternate username, User, Group, Comments, Status, Network equipment type, Manufacturer, Model, Serial number, Inventory number, Network, UUID, Update source. Se inventariado pelo agente automático: Agents, Public contact address, Agents Status, Useragent, Last contact, Request inventory, Inventory tag, Last inventory update.

> [!quote] Abas do formulário
> Impact Analysis (diagrama de dependências/impactos, salvável e exportável); Operating systems (Name, Version, Architecture, Service Pack, Kernel, Edition, Product ID, Serial number, Company, Owner, Host ID, Installation date); Software (lista software do inventário + manual; instalação lógica manual; adicionar em *Assets > Software*); Components (BIOS, Processor, Memory, Hard Drive, Network card, Drive, Battery, Graphics card, Soundcard, Controller); Lines (linhas telefônicas); Volumes (Name, Automatic inventory Yes/No, partition, Mount point, File system, Global size, Free size, Free percentage, Encryption/cadeado).

> [!quote] Aba "Network Ports"
> "This tab allows to manage the network ports attached to an equipment." Campos: Name, Port number, MTU, Speed, Internal status, Last change, Number of I/O bytes, Number of I/O errors, Duplex, VLAN, Connected to, Connection, Deleted.

> [!quote] Aba "Network Name" e "Sockets"
> Network names: "used to organise and identify network devices in a more structured way. They usually appear as a dropdown list." Campos: Network name, IP addresses, IP networks. Sockets: "the list of physical sockets present on the hardware. These sockets can be Ethernet, USB, HDMI, etc. This information cannot be returned by the automatic inventory, so you have to add it manually. It enables hardware to be linked by cables. Socket is also linked to the cables object."

> [!quote] Abas comuns e específicas
> Management (informações financeiras/administrativas), Contracts (loan, maintenance, support...), Documents, Knowledge Base, Tickets, Problems, Changes, Projects, Links (URL externa, gerar arquivo RDP), Notes, Reservations ("By default, equipment cannot be reserved; you must first authorize this action manually"), Certificates, Locks (impedir alteração de campo no upload de inventário), Domains, Appliances, Databases, Import information ("governed by equipment import rules — administration > rules > Rules for import and link equipments"), Historical. "Network equipments do not have specific actions; report to common actions."

## Sustenta
- [[Equipamento de Rede (ativo)]]
- [[Campos do formulário de Equipamento de Rede]]
- [[Campos da aba Portas de Rede (Network Ports)]]
