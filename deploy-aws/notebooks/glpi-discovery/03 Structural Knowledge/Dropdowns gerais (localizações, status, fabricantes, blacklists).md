---
title: Dropdowns gerais (localizações, status, fabricantes, blacklists)
aliases: [Locations, Status of items, Manufacturers, Blacklists]
tags: [dropdown, location, status, manufacturer, blacklist]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-006 · Dropdowns comuns localizações status fabricantes blacklists|EV-2-f2-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dropdowns gerais (localizações, status, fabricantes, blacklists)

Dropdowns comuns, usados em muitos módulos. Categoria de [[Catálogo de tipos de dropdown (configuração)]].

## Localizações (Locations)
Lista **em árvore**, delegável por entidade. Registro com prédio, sala, GPS, endereço (ver [[Campos de localização (dropdown)]]). Abas: localizações filhas, **Items** (itens com esta localização, filtrável por tipo), **Sockets** (sockets de rede da localização, adição única ou múltipla com prefixo/sufixo), tradução, histórico.

## Status de itens (Status of items)
Lista **em árvore**, delegável por entidade. Define os status atribuíveis a itens. Complementa [[Status de itens (visão específica)]] / [[Status de itens]].

## Fabricantes (Manufacturers)
Lista **plana**, válida para todas as entidades. **Não pode ser traduzida.**

## Blacklists
Lista **plana**, todas as entidades. Inclui o valor a bloquear e o tipo (**IP, MAC, número de série, UUID ou e-mail**). Usada em importações automáticas via [[Agente de Inventário (protocolo)]] ou pelo receptor. Não traduzível.

## Blacklisted email content
Lista **plana**, todas as entidades. Permite ao receptor **não importar** um e-mail contendo o texto definido (combate a spam quando há criação de ticket por e-mails anônimos). Não traduzível. Relaciona-se a [[Coletor de E-mail (MailCollector)]].
