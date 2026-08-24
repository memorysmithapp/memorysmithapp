---
title: EV-2-c2-006 · Cabos (cables.rst)
aliases: [EV-2-c2-006]
tags: [evidence, assets, cable, connectivity, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/cables.rst · Cables (documento inteiro)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-c2-006 · Cabos

> [!quote] modules/assets/cables.rst · "Cables"
> "Any type of cable can be managed (ethernet, USB, HDMI, etc.). You can link a cable between 2 devices, and indicate the physical location where the cable is plugged into a device. You can also create tickets, problems, etc. from this cable for complete management."

> [!quote] Campos ao adicionar (+ Add)
> Name, Status, Cable Type, Technician in charge, Inventory number, Comments, Cable strand, Color.

> [!quote] Cable Type e Cable Strand
> Cable Type: "You can add the type of cable that links the hardware (USB, ethernet, HDMI, etc.). Select the type of cable required. You can create a new one by clicking on +." Lista de tipos em **setup > dropdowns > cable management**.
> Cable Strand: seção presente no doc porém **sem conteúdo** (vazia).

> [!quote] Endpoint (ligação de 2 dispositivos)
> "You can link 2 devices together to find out which cable connects them and on which socket. To be linked to a socket, it must be specified on the hardware concerned." Endpoint A: Type of asset, The asset, The socket model, The socket, e (se informado no equipamento) a posição. "Do the same with endpoint B."

> [!quote] Abas Management e Tickets
> Management: informações financeiras/administrativas (se ativadas). Tickets: "lists all the tickets created for this object. You can not link a ticket here or create a new ticket. To link an object to a cable, go to Assistance > Ticket."

## Sustenta
- [[Cabo (ativo)]]
- [[Campos do formulário de Cabo]]
- [[Ligação de dois dispositivos por cabo (endpoints)]]
