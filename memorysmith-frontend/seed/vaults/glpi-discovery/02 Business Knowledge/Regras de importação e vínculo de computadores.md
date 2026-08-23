---
title: Regras de importação e vínculo de computadores
aliases: [Rules for importing and linking computers, Import and link rules]
tags: [regras, inventario, importacao, vinculo, doc]
type: rule
status: confirmed
source: "[[EV-2-e2-012 · Regras de inventário - atribuição a entidade e importação-vínculo|EV-2-e2-012]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Motor de regras específico que **controla o processo de importar, vincular ou recusar** máquinas vindas de uma ferramenta de inventário.

## Critérios
Campos genéricos (name, description, serial number, domain, IP, subnet) + campos da ferramenta + **entidade de destino** + um **status** usado para buscar máquina já presente no GLPI.

## Ações
Ignorar import / vincular se possível / importar se possível / recusar import.

## Comportamento
- O motor **para na primeira regra correspondente**.
- A busca por máquina já presente ocorre **apenas na entidade de destino**.

Exemplos do doc: recusar imports de um servidor específico; vincular por serial já presente com status "in stock"; recusar por serial inválido ("To be Filled By OEM").

## Ver também
- [[Regras de atribuição de item a entidade (inventário)]]
- [[Importação de computador do inventário (fluxo)]]
