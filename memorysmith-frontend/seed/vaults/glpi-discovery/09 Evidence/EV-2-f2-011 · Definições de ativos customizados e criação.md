---
title: EV-2-f2-011 · Definições de ativos customizados e criação
aliases: [EV-2-f2-011]
tags: [evidence, asset-definition, custom-asset, generic-object]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/asset_definitions/asset_definitions.rst · seções Asset Definitions/Migration/Definitions/Create an asset"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-011 · Definições de ativos customizados e criação

> [!quote] asset_definitions.rst — introdução e migração
> Desde o **GLPI 11**, o plugin de ativos genéricos (generic objects) foi integrado nativamente ao GLPI, permitindo criar **tipos de ativo customizados** conforme a necessidade. A migração de generic objects exige que o plugin **generic objects** esteja instalado e é feita a partir do banco GLPI 10 (não é possível importar ativos do GLPI 10 para o 11); após a migração, em modo CLI: `php bin/console migration:genericobject_plugin_to_core`.

> [!quote] asset_definitions.rst — Definitions e Create an asset
> Asset definitions permitem adicionar ativos não disponíveis nativamente (ex.: servidores ou laptops separados do tipo Computers). Cada ativo customizado pode se comportar como qualquer outro ativo via **capacidades**. Para criar: **+ Add** e preencher: **Label** (aparece na lista de ativos), **System name** (não pode ser mudado depois), **Comments**, **Active**, **Icon**. O campo **system name** corresponde ao que será usado em desenvolvimento (chamadas de API, webhooks); pode ser personalizado, mas algumas palavras são reservadas (classes do GLPI como Computer, Monitor). Itens ligados ao system name "Example" terão a classe `Glpi\CustomAsset\ExampleAsset`. Após a criação surge o erro "There is currently no profile with access to items with current definition" — é preciso ir à aba **profiles**.

## Sustenta
- [[Definição de Ativo Customizado (Asset Definition) — doc]]
- [[Criação de um ativo customizado (procedimento)]]
