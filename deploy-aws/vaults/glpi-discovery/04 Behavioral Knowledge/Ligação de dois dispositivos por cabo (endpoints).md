---
title: Ligação de dois dispositivos por cabo (endpoints)
aliases: [Endpoint A, Endpoint B, Cable endpoints]
tags: [cable, socket, connectivity, procedure, doc]
type: use-case
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-006 · Cabos (cables.rst)|EV-2-c2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ligação de dois dispositivos por cabo (endpoints)

Procedimento para ligar dois dispositivos com um [[Cabo (ativo)]], registrando qual cabo os conecta e em qual **socket** de cada um. Para ser ligado a um socket, este precisa estar previamente declarado no hardware ([[Rede (portas, IP, VLAN)]]).

## Passos
1. Em **Endpoint A**, selecionar o primeiro objeto informando:
   - Type of asset (tipo de ativo)
   - The asset (o ativo)
   - The socket model (modelo do socket)
   - The socket (o socket)
   - A posição (adicionada automaticamente se informada no equipamento)
2. Repetir os mesmos passos em **Endpoint B** para o segundo dispositivo.

> [!note] A partir do cabo também é possível criar tickets, problemas etc., mas o vínculo de ticket é feito em Assistance > Ticket (não na aba Tickets do cabo).
