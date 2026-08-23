---
title: EV-2-f1-007 · Configuração global de ativos e inventário
aliases: [EV-2-f1-007]
tags: [evidence, ativos, inventario, configuracao-geral]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/general/assets.rst · Assets"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/assets.rst — "Assets"
> "This tab permit to configure global parameters for inventory."
> **Assets**: Enable the financial and administrative information by default (todos os objetos); Software category deleted by the dictionary rules (por padrão movidos p/ categoria FUSION); End of fiscal year (usado na seção Management); Automatic fields (marcados por *) — campos gerados a partir de template, incrementáveis por entidade ou globalmente; Restrict monitor/device/phone/printer management — ao criar manualmente, o usuário escolhe o tipo de gestão (unitária ou global); a gestão global importa o elemento uma só vez, a unitária importa quantas vezes for usado; é possível restringir o tipo por equipamento.
> **Automatically update of the elements related to the computers**: interfaceamento com ferramenta de inventário (nativo ou plugin).
> - **When connecting or updating**: ao conectar dispositivo unitário a um computador, recuperar informações do computador (ex.: User).
> - **When disconnecting**: ao desconectar, remover certos dados do Computer (ex.: User). Ex.: monitor conectado assume status "Production"; ao desconectar, "Available".

## Sustenta
- [[Configuração Global de Ativos e Inventário]]
