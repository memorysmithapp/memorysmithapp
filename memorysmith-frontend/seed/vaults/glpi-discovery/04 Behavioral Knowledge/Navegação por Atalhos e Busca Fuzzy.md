---
title: Navegação por Atalhos e Busca Fuzzy
aliases: [Keyboard shortcuts, Atalhos de teclado, Fuzzy navigation, Busca aproximada]
tags: [use-case, navigation, keyboard, shortcuts, fuzzy]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-005 · Navegação por módulos, atalhos de teclado e busca fuzzy|EV-2-a1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Navegação por Atalhos e Busca Fuzzy

O GLPI oferece navegação por teclado entre módulos/submódulos, além da navegação pela barra superior descrita em [[Módulos de Navegação do GLPI]].

## Atalhos de teclado
| Tecla | Destino |
|---|---|
| `1` | Home |
| `o` / `s` | Computers / Software (Assets) |
| `t` / `a` / `p` | Tickets / Statistics / Planning (Assistance) |
| `d` | Documents (Management) |
| `b` / `r` / `e` | Knowledge base / Reservations / Reports (Tools) |
| `u` / `g` | Users / Groups (Administration) |
| `n` | Dropdowns (Setup) |

A combinação de teclas varia por SO/navegador: **Firefox/Chrome** = `Alt`+`Shift`+*atalho*; **Opera** = `Esc`+`Shift`+*atalho*.

## Busca aproximada (Fuzzy)
Desde a versão **9.2**, há navegação com busca aproximada (fuzzy) pelo atalho `Ctrl`+`Alt`+`G`. Abre uma janela modal para filtrar, via campo de busca, **todos os menus** do GLPI (todos os níveis, inclusive o 3º — dropdowns e componentes). Na janela: `↑`/`↓` navegam os resultados, `Enter` abre o resultado selecionado, `Esc` fecha.

## Relações
- Complementa: [[Módulos de Navegação do GLPI]], [[Busca Rápida (Quick Search)]].
