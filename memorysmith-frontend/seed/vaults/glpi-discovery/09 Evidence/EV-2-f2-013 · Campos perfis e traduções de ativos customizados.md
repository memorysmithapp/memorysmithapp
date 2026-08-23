---
title: EV-2-f2-013 · Campos perfis e traduções de ativos customizados
aliases: [EV-2-f2-013]
tags: [evidence, asset-definition, custom-fields, profiles, translation]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/asset_definitions/asset_definitions.rst · seções Fields/Profiles/Translations"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-013 · Campos perfis e traduções de ativos customizados

> [!quote] asset_definitions.rst — Fields (criar campo customizado)
> A aba **Fields** adiciona campos extras e permite ocultar ou reordenar os nativos. Ao criar (**+ New field**): **Label** (nome exibido no formulário/resultados de busca); **System name** (usado em desenvolvimento — na API legada o nome é prefixado por `custom_` para evitar conflito com campos padrão); **Type** (string, date, URL, dropdown, yes/no, text, date and time, number — **não pode ser modificado após salvar**); **Full width** (campo ocupa toda a largura do formulário); **Mandatory**; **Readonly for these profiles** (as permissões da aba profiles têm precedência); **Hidden for these profiles** (as autorizações da aba profiles têm precedência — visível a um perfil mesmo se selecionado aqui); **Default values**. Para campo dropdown, seleciona-se o tipo de item da lista (extenso catálogo de tipos de item), permite seleção múltipla e valor padrão.

> [!quote] asset_definitions.rst — Fields (excluir/ocultar/modificar/ordenar)
> **Não é possível excluir** um campo criado por padrão; só campos adicionados pelo usuário podem ser excluídos (ocultar ícone → lixeira, ação irreversível). Qualquer campo pode ser **oculto** (drag-and-drop de volta à lista para restaurar). Num campo **padrão** só se pode modificar Full width, Mandatory, Readonly for these profiles, Hidden for these profiles. Num campo **customizado** pode-se modificar Label, System name (muda automaticamente ao mudar o Label), Full width, Mandatory, Readonly/Hidden for these profiles, Default value — mas **o tipo não pode ser modificado após salvo**. A ordem muda por drag-and-drop.

> [!quote] asset_definitions.rst — Profiles e Translations
> **Profiles**: autoriza permissões sobre os ativos deste tipo por perfil: Create, View all, Update all, Purge, Delete, View assigned, View owned, Update assigned, Update owned. Pode-se adicionar perfis que podem associar o ativo a tickets, problemas ou mudanças (seleção múltipla). **Translations**: traduz o **label** e o **system name** (+ New translation → selecionar campo → idioma → traduções): One (singular do label), Many (plural do label), Other (tradução que aparece na lista de ativos).

## Sustenta
- [[Gestão de campos customizados de ativos (procedimento)]]
- [[Tipos e propriedades de campo customizado de ativos]]
