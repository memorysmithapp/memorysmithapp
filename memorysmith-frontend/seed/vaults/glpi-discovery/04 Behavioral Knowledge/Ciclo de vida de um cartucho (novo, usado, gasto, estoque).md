---
title: Ciclo de vida de um cartucho (novo, usado, gasto, estoque)
aliases: [Cartridge lifecycle, Ciclo de vida do cartucho]
tags: [behavioral, cartridges, printer, lifecycle, stock, state-machine]
type: flow
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-g3-009 · Aba Cartuchos (ciclo de vida na impressora)|EV-2-g3-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ciclo de vida de um cartucho (novo, usado, gasto, estoque)

Na aba **Cartridges** de uma impressora, os cartuchos percorrem estados de estoque/uso. A primeira tabela lista os **novos ou em uso**; a segunda, os identificados como **fim de vida**. É a visão de uso do modelo [[Cartucho (ativo)]].

## Estados e transições
- **New**: ao criar, seleciona-se a quantidade e clica **Add cartridges** (status padrão = new).
- **New → Used** (*Install*): em **Assets > Printer > (impressora) > Cartridges**, em **Property** seleciona o cartucho, o número e **Install**.
- **Used → Worn / End of life**: na aba *used cartridges*, selecionar, **Actions > End of life > Post**.
- **Used/Worn → Back to stock**: nas abas *used* ou *worm cartridges*, **Actions > Back to stock > Post**.

> [!note] Diagrama de estados
> ```mermaid
> stateDiagram-v2
>     [*] --> New: Add cartridges
>     New --> Used: Install
>     Used --> Worn: Actions - End of life
>     Used --> Stock: Actions - Back to stock
>     Worn --> Stock: Actions - Back to stock
>     Stock --> Used: Install
> ```

## Ver também
- [[Cartucho (ativo)]] · [[Modelos de Impressora (compartilhar cartuchos)]] · [[Gestão de quantidades de consumíveis (alocação)]]
