---
title: Paletas Customizadas (temas SCSS)
aliases: [custom palettes, temas, paletas, data-glpi-theme, Auror]
tags: [temas, paletas, scss, ui, personalizacao, operacional]
type: process
status: confirmed
source: "[[EV-2-g1-002 · Paletas customizadas (custom_palettes.rst)|EV-2-g1-002]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A partir do **GLPI 11.0**, é possível criar **paletas customizadas** (temas). São arquivos **SCSS** com regras CSS, usados da mesma forma que as paletas nativas na seleção de tema das preferências do usuário (ver [[Personalização da Experiência do Usuário (capacidade)]]).

## Localização

Os arquivos de paleta ficam na pasta `files/_themes` da instalação — ou no local definido pelas opções de configuração `GLPI_VAR_DIR` ou `GLPI_THEMES_DIR`, se sobrescritas.

## Regras de construção

- **Todos os arquivos de paleta são carregados o tempo todo**, o que permite a **pré-visualização instantânea** ao trocar a paleta e facilita a depuração. Por isso, as regras CSS **devem ser restringidas** com o seletor `:root[data-glpi-theme='mycustompalette']` (onde `mycustompalette` é o nome do arquivo, e portanto da paleta).
- Recomenda-se alterar apenas variáveis CSS prefixadas por `--tblr` (Tabler) ou `--glpi`, para manter a uniformidade visual; ajustes finos em elementos específicos são permitidos.
- Todas as paletas são consideradas **extensão da paleta base `Auror`**.

## Swatch (prévia de cores)

A paleta pode definir uma prévia de quatro cores exibida ao lado do nome na lista suspensa, de duas formas:
1. **Recomendada** — variáveis `--glpi-palette-color-1` a `-4` na raiz da paleta, com cores estáticas (não podem ser calculadas).
2. Imagem `mycustompalette.png` (60×20 px) numa pasta `previews` junto ao CSS.

## Paleta escura

Para marcar a paleta como **escura**, inclui-se `$is-dark: true;` em qualquer lugar do arquivo (essa variável SCSS não precisa estar dentro do seletor `:root` — o GLPI apenas verifica sua existência ao carregar). Quando escura, o GLPI define o atributo `data-glpi-theme-dark='1'` no elemento HTML raiz, incluindo automaticamente regras CSS auxiliares.

> [!info] Compilação
> Os arquivos SCSS de paleta são compilados pelo comando `glpi:build:compile_scss` — ver [[Comandos de CLI - Regras, Ativos e Ferramentas]].

Ligações: [[Configuração Avançada do GLPI (visão geral)]]
