---
title: Graph View
aliases:
  - Grafo
  - Graph
  - Local Graph
  - Visualização de Rede
tags:
  - obsidian
  - graph
  - pkm
  - ui
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Graph view** é o core plugin que desenha o vault como grafo: cada círculo é uma nota e cada linha é um [[Internal Link (Wikilink)]] entre duas notas.

## Conceito

O grafo não é ilustração — é a única superfície onde a topologia do vault fica visível de uma vez. Quanto mais nós referenciam um nó, **maior ele fica**; nós isolados denunciam notas órfãs; ilhas sem ponte denunciam clusters que não conversam. Os filtros existem para transformar a figura bonita em pergunta respondível.

> [!success] Ferramenta de diagnóstico, não decoração
> Um grafo denso e colorido não prova nada. O que prova é a resposta a uma pergunta específica: quantas notas com esta tag não têm nenhum link? Quantos links apontam para notas que ainda não existem? Filtros e grupos são o instrumento; a imagem é só a saída.

## Características

Abre pelo **Open graph view** no [[Workspace Layout|Ribbon]]. Hover destaca as conexões do nó, clique abre a nota, botão direito abre o menu de contexto. Zoom com scroll ou `+`/`-`, movimento por arrasto ou setas — segure `Shift` para acelerar. As configurações abrem no ícone de engrenagem, com **Restore default settings** no canto.

**Filters** — o que aparece:
- **Search files** filtra por termo de busca, com a gramática de [[Search Syntax (Obsidian)]].
- **Tags** mostra ou esconde tags no grafo.
- **Attachments** mostra ou esconde [[Attachment|anexos]].
- **Existing files only** limita às notas que realmente existem.
- **Orphans** mostra ou esconde notas sem nenhum link.

> [!quote]
> Since a note doesn't need to exist to link to it, this can help limit your graph to notes that you actually have in your vault.

**Groups** — cria grupos por termo de busca e atribui **cor** a cada um (New group → termo → círculo colorido).

**Display** — **Arrows** (direção de cada link), **Text fade threshold** (transparência do nome), **Node size**, **Link thickness**, **Animate** (dispara o time-lapse).

**Forces** — **Center force** (compactação; valor alto deixa o grafo mais circular), **Repel force** (quanto um nó empurra os outros), **Link force** (tensão do link, como um elástico), **Link distance** (comprimento das linhas).

**Time-lapse** — notas e anexos aparecem em ordem cronológica por **creation time**.

Arquivos que casam com **Excluded files** não aparecem no Graph view.

## Comparação

| | Graph view (global) | Local graph |
|---|---|---|
| Escopo | Todo o vault | Vizinhança da nota ativa |
| Abertura | Ribbon | Comando **Open local graph** |
| Settings | Todas | Todas, **mais Depth** |
| Depth | Não existe | Slider no topo do painel de filtros; cada nível revela os vizinhos do nível anterior |
| Bookmark | Sim, botão direito na aba → Bookmark | **Não é possível** |
| Uso | Diagnóstico da topologia | Contexto imediato durante a escrita |

Como linked view, o local graph acompanha a aba de nota a que está preso — ver [[Workspace Layout]].

## Veja também

- [[Internal Link (Wikilink)]]
- [[Backlink]]
- [[Search Syntax (Obsidian)]]
- [[Knowledge Graph]]
- [[Diagnóstico do Grafo de Conhecimento]]
- [[Metadata Cache]]
