---
title: Uso da Análise de Impacto (montar o diagrama de dependências)
aliases: [Impact analysis procedure, Montar análise de impacto]
tags: [behavioral, impact-analysis, dependency, diagram, procedure]
type: flow
maturity: evergreen
reviewed: false
source: "[[EV-2-g3-015 · Análise de Impacto (procedimento e conceitos)|EV-2-g3-015]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Uso da Análise de Impacto (montar o diagrama de dependências)

Procedimento de usuário para desenhar, na aba **Impact Analysis**, um diagrama de infraestrutura que mostra dependências e impactos em caso de perda de um equipamento. Complementa a nota estrutural [[Aba Análise de Impacto (diagrama de dependências)]] com o passo-a-passo e a semântica dos links.

> [!note] Conceitos-chave
> - **Impact** (seta vermelha): se o elemento falha, impacta todos os ligados.
> - **Dependency** (seta azul): elemento diretamente afetado pelo impacto, que não afeta necessariamente os ligados a ele.
> - Sempre no **contexto do elemento selecionado** — os impactos/dependências mudam conforme o ponto de vista.

## Passo-a-passo
1. Garantir que o equipamento está **ligado** (powered up).
2. Em **Assets > Network devices**, selecionar o hardware; na aba **impact analysis** ele aparece.
3. Menu à direita **+**, escolher a categoria, **arrastar/soltar** os hardwares.
4. Ícone **diagonal line** para criar links: segurar sobre o 1º elemento e soltar sobre o destino.

## Cores dos links
- **Vermelho** = impacto · **Azul** = dependência · **Roxo** = mutuamente dependentes/impactados (relação nos dois sentidos) · **Preto** = sem dependência nem impacto a partir do elemento atual.

## Recursos
- **Groups** (ícone object-group): agrupam elementos dependentes de um equipamento, com nome e cor.
- **Save** (floppy), **Delete** (trashbin — apaga elemento e link), **Download** (PNG), **Maximize** (tela cheia; roda do mouse = zoom).
- **Link configuration** (adjustments): **Visibility** (só impactos e/ou dependências), **Colours**, **Maximum depth** (nº de elementos exibidos; "infinity" = sem limite).

## Ver também
- [[Aba Análise de Impacto (diagrama de dependências)]] · [[Aba de Análise (impactos, causas, sintomas, controles)]] · [[Gestão de Ativos e Configuração (SACM)]]
