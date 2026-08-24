---
title: Ações Massivas (bulk actions)
aliases: [Massive actions, Bulk actions, Ações em lote]
tags: [use-case, massive-actions, bulk, search]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-a1-007 · Motor de busca da UI (básica, multicritério, avançada, export, ações massivas)|EV-2-a1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ações Massivas (bulk actions)

Sistema de **ações massivas** integrado ao motor de busca, para modificações em lote e execução de ações sobre todos os elementos selecionados.

## Exemplos de ações (variam por tipo de item)
*Put in trashbin*, *Delete permanently*, *Restore*, *Connect*/*Disconnect*, *Install*, *Update*, *Add a contract*, *Enable the financial and administrative information*, *Add to transfer list*, *Synchronize*.

## Fluxo de uso
1. Selecionar os elementos desejados (checkbox no cabeçalho da tabela — topo e rodapé — seleciona/deseleciona todos).
2. Clicar no botão **Actions** (disponível no topo e no rodapé da lista).
3. Escolher o tipo de ação; opcionalmente apresentam-se opções e um botão de validação.
4. Resultados e mensagens são exibidos ao fim da execução.

> [!note]
> Um sistema similar de ações existe em certas listas dentro dos próprios objetos, com operação idêntica.

> [!warning]
> O número de elementos manipuláveis simultaneamente é limitado por `max_input_vars` (ou `suhosin.post.max_vars`) na configuração PHP. Pode surgir mensagem de que edições massivas estão desabilitadas — aumentar os valores no PHP ou reduzir itens exibidos.

## Relações
- Parte de: [[Busca na Interface (uso do motor de busca)]], [[Visualização e Gestão de Registros]].
- Ponte de código: [[Motor de Busca (Search Engine)]], [[Ciclo de vida de um item (add-update-delete)]].

> [!note] Ver também
> Conceito em [[Ações em massa (massive actions)]].
