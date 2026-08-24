---
title: Campos de localização (dropdown)
aliases: [Campos de Location, GPS de localização]
tags: [data, dropdown, location, fields]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-006 · Dropdowns comuns localizações status fabricantes blacklists|EV-2-f2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos de localização (dropdown)

Campos do registro de uma **localização** (dropdown em árvore), parte de [[Dropdowns gerais (localizações, status, fabricantes, blacklists)]].

| Campo | Significado |
|---|---|
| Localização pai | Posição na árvore (Location > Sub-location > ...). |
| Building number | Número do prédio. |
| Room number | Número da sala. |
| GPS (longitude, latitude, altitude) | Coordenadas geográficas; um mapa auxilia a defini-las (usa a localização aproximada do usuário se autorizado). |
| Street address | Endereço. |

Pode ser **delegada por entidade**. Abas relacionadas: **Items** (itens nesta localização, filtrável por tipo), **Sockets** (sockets de rede da localização), tradução, histórico.

Relaciona-se a [[Composição de um Ativo (componentes)]] e [[Rede (portas, IP, VLAN)]] (sockets).
