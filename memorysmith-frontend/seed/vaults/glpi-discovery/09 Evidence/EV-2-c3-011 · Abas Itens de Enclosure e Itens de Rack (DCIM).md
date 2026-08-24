---
title: EV-2-c3-011 · Abas Itens de Enclosure e Itens de Rack (DCIM)
aliases: [EV-2-c3-011]
tags: [evidence, doc, assets, dcim, rack, enclosure, pdu]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "SRC-002 · modules/assets/tabs/enclosures_items.rst · Items"
  - "SRC-002 · modules/assets/tabs/rack_items.rst · Items"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/enclosures_items.rst — "Items" (enclosure/chassis)
> A aba exibe a lista de itens vinculados ao chassis (enclosure), permitindo melhor organização e gestão simplificada por uma visão centralizada.
>
> - **Adicionar um item:** o item já deve existir no GLPI; clicar em **Add new item to this enclosure**; selecionar o **item type** (computer, monitor, network device, peripheral, PDU, passive device); selecionar o **item**; selecionar o **enclosure** onde posicioná-lo; escolher uma **position**; clicar em **+ Add**.
> - **Excluir um item:** usar a ação em massa (massive action).
>
> Capturas de tela: `enclosure_item.png`, `enclosure_add_item.png`, `enclosure_remove_item.png`.

> [!quote] modules/assets/tabs/rack_items.rst — "Items" (rack)
> Racks permitem gestão visual precisa da infraestrutura física de um parque de TI: gestão de espaço, planejamento de adições de equipamentos e monitoramento de intervenções num datacenter.
>
> - **Adicionar um item:** clicar em **+**; escolher o ativo em **item type** e **Item**; selecionar opções: Rack, Position, Orientation (do ponto de vista do rack), Background color, Horizontal position, Reserved position. Após **+ Add**, o material aparece no rack na posição indicada. Pode-se editar clicando na caneta e arrastar um item para movê-lo mais rápido.
> - **Excluir um item:** clicar na caneta do item e em **Delete permanently**; isso remove apenas a conexão com o rack, não o equipamento em si.
> - **Customizar um item:** para preencher a caixa à direita (peso e potência), inserir os valores manualmente; em **Setup > Dropdown > Models** selecionar o tipo de ativo, o ativo, preencher e adicionar imagens visíveis no rack. Sem imagem, pode-se definir uma cor por item; alterna-se entre imagens e cores pelo botão **images**.
> - **Power units:** pode-se adicionar **PDUs** a partir de power units — **+ Add**, escolher **racked** ou **placed at rack side**, escolher o PDU em item, preencher Rack/Position/Orientation/Horizontal position/Background colour/Reserved position. Se os dados de consumo estão corretos, alimentam as power units. Para excluir um PDU, clicar na imagem do PDU e em **delete permanently**.
>
> Capturas de tela: `rack_items.png`, `rack_add_asset.png`, `rack_add_asset_option.png`, `rack_delete_asset.png`, `rack_space.png`, `rack_custom_item.png`, `rack_view_custom_item.png`, `rack_delete_pdu.png`, `rack_delete_pdu1.png`.

## Sustenta
- [[Aba Itens do Enclosure (ativos)]]
- [[Aba Itens do Rack (ativos)]]
