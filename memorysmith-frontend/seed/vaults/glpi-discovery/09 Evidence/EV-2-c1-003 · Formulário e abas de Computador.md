---
title: EV-2-c1-003 · Formulário e abas de Computador
aliases: [EV-2-c1-003]
tags: [evidence, assets, computer, doc]
type: evidence
status: confirmed
source: "SRC-002 · modules/assets/computers.rst · Computers (todas as seções/abas)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c1-003 · Formulário e abas de Computador

> [!quote] modules/assets/computers.rst
> "Each computer has its own information and related hardware (monitor, components, etc.). All this information is divided into tabs. You can find your computers in **Assets > Computers**."

**Aba Computer (campos básicos):** Name; Location; Technician in charge; Group in charge; Alternate username number; Alternate username; User; Group; Comments; Status; Computer type; Manufacturer; Model; Serial number; Inventory number; Network; UUID; Update source.

**Se inventariado pelo GLPI Agent** exibe: Agents, Public contact address, Agents Status, Useragent, Last contact, Request inventory, Inventory tag, Last inventory update.

> [!tip] Bloqueio de campos
> "if you modify a field manually, it will be considered locked. This will prevent it from being modified the next time the automatic inventory is uploaded."

**Abas do formulário de Computador:** Impact Analysis; Operating systems (Name, Version, Architecture, Service Pack, Kernel, Edition, Product ID, Serial number, Company, Owner, Host ID, Installation date); Components (BIOS, Processor, Memory, Hard Drive, Network card, Drive, Battery, Graphics card, Sound card, Controller); Lines; Volumes (Name, Automatic inventory Yes/No, partition, Mount point, File system, Global size, Free size, Free percentage, Encryption); Software; Connections (Device, Monitor, Phone, Printers); Network Ports (Name, Port number, MTU, Speed, Internal status, Last change, Number of I/O bytes, Number of I/O errors, Duplex, VLAN, Connected to, Connection, Deleted); Sockets; Remote management; Management (financeiro/administrativo); Contracts; Documents; Virtualization; Antiviruses; Knowledge Base; Tickets; Problems; Changes; Links; Certificates; Locks; Notes; Reservations; Domains; Appliances; Databases; Import information; Historical; All.

> [!note] Detalhes
> - **Sockets** e **Remote management** não são retornados pelo inventário automático — adição manual.
> - **Virtualization**: pode criar um novo computador por VM encontrada ou apenas referenciar as VMs na aba.
> - **Antiviruses** (Windows): precisa ser detectado no Windows Security Center.
> - **Import information**: governada por *rules for import and link equipments* (Administration > Rules).

## Sustenta
- [[Campos do formulário de Computador]]
- [[Campos comuns de um ativo (formulário)]]
- [[Abas comuns de um ativo (visão do usuário)]]
- [[Campos da aba Sistemas operacionais]]
- [[Campos da aba Volumes]]
- [[Campos da aba Portas de rede]]
- [[Componentes de hardware de um ativo (lista)]]
- [[Bloqueio de campos manuais no inventário (locks)]]
</content>
