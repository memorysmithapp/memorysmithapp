---
title: EV-2-g1-002 · Paletas customizadas (custom_palettes.rst)
aliases: [EV-2-g1-002]
tags: [evidence, temas, paletas, scss, ui, personalizacao]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · advanced/custom_palettes.rst · Create custom palettes"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Trecho / Paráfrase

> [!quote] advanced/custom_palettes.rst — "Create custom palettes"
> Paletas (ou temas) customizadas são suportadas a partir do **GLPI 11.0**. São arquivos **SCSS** contendo regras CSS e podem ser usadas como as paletas nativas. Devem ser colocadas na pasta `files/_themes` da instalação (ou no local definido por `GLPI_VAR_DIR` / `GLPI_THEMES_DIR`).
>
> Todos os arquivos de paleta são carregados o tempo todo (permite pré-visualização instantânea ao trocar a paleta nas preferências do usuário e facilita depuração). Por isso, as regras CSS devem ser restringidas com o seletor `:root[data-glpi-theme='mycustompalette']` (onde *mycustompalette* é o nome do arquivo). Recomenda-se restringir-se a variáveis CSS prefixadas por `--tblr` ou `--glpi` para manter uniformidade.
>
> A paleta pode definir um **"swatch"** (prévia de quatro cores exibida na lista suspensa) de duas formas: (1) recomendada — variáveis `--glpi-palette-color-n` (1 a 4), com cores estáticas; ou (2) uma imagem `mycustompalette.png` de 60×20 px numa pasta `previews`.
>
> Todas as paletas são consideradas extensão da paleta base, que é **`Auror`**. Para que a paleta seja tratada como **escura**, inclui-se `$is-dark: true;` em qualquer lugar do arquivo (não precisa estar dentro do seletor `:root`). Quando escura, o GLPI define o atributo `data-glpi-theme-dark='1'` no elemento HTML raiz, incluindo automaticamente regras CSS auxiliares.

## Sustenta

- [[Paletas Customizadas (temas SCSS)]]
