---
title: INV-2-f1-001 · Semântica dos parâmetros Items seen e Global search
aliases: [INV-2-f1-001]
tags: [investigation, consumidor/cad, configuracao-geral]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

## Dúvida
Na aba **General setup** (Setup > General), o doc lista os parâmetros **Items seen** e **Global search** sem descrição — enquanto todos os demais campos da mesma tela são descritos.

- **Global search**: o doc apenas diz "enable global search adding a search field at the top of the interface"; não detalha escopo (quais tipos entram na busca global) nem impacto de performance.
- **Items seen**: aparece como um item de lista **vazio**, sem qualquer explicação.

## O que disparou
Leitura integral de `modules/configuration/general/general_configuration.rst` (linhas 28-29).

## Próximos passos sugeridos
- Cruzar com o código-fonte (sessão 1) — provável opção `Config` relacionada a "items seen" (histórico de itens vistos recentemente) e à [[Busca na Interface (uso do motor de busca)|busca global]].
- Confirmar se "Items seen" controla o widget de itens vistos recentemente na home/menu.

> [!question]
> Origem documental incompleta: afirmar a semântica exata desses dois parâmetros exigiria evidência adicional (código ou UI).
