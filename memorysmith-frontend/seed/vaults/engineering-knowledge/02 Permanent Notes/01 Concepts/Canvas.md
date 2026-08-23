---
title: Canvas
aliases:
  - Quadro Infinito
  - JSON Canvas
  - .canvas
tags:
  - obsidian
  - plugin
  - pkm
  - note-taking
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Canvas** é o core plugin de note-taking visual: um espaço 2D infinito onde notas, anexos e páginas web viram cards conectáveis por linhas, salvo como arquivo `.canvas` no formato aberto **JSON Canvas**.

## Conceito

O vault é uma estrutura de nomes e links; o canvas é uma estrutura de **posições**. Duas notas próximas na tela dizem algo que nenhum frontmatter expressa, e uma aresta rotulada "contradiz" carrega uma relação que o [[Internal Link (Wikilink)]] não tipa.

> [!success] Pensamento espacial
> Posição, adjacência, agrupamento e rótulo de aresta são canais de significado *pré-verbais*. Servem exatamente para o momento em que a ideia ainda não está formada o bastante para virar nota — a fase em que impor um nome de arquivo custa mais do que ajuda.

O preço é que essa camada de significado só existe dentro do arquivo `.canvas`. Como o formato é aberto e documentado (jsoncanvas.org), o custo não vira lock-in — ver [[Data Portability]].

## Características

- Criação: **Canvas: Create new canvas** na Command palette, botão direito numa pasta no File explorer → **New canvas**, ou **Create new canvas** no Ribbon.
- Tipos de card: **text card** (Markdown, links e code blocks, como numa nota), **nota do vault**, **mídia** (imagem, áudio, PDF, tipos não reconhecidos), **web page** (botão direito → Add web page, ou arrastar a URL do navegador) e **pasta inteira** arrastada do File explorer, que adiciona todos os arquivos dela.
- **Swap file** troca um card de nota ou de mídia por outro do mesmo tipo; **Convert to file...** transforma um text card em arquivo do vault.

> [!warning]
> Text cards **não aparecem em [[Backlink|Backlinks]]**. Para que apareçam, é preciso convertê-los em arquivo com **Convert to file...**.

- Conexões: hover na borda de um card até surgir o círculo cheio, arrastar até outro card. Soltando no vazio, cria-se um **card novo** na outra ponta. Duplo clique na linha adiciona **label**; botão direito na linha oferece **Go to target** e **Go to source** quando os cards estão distantes.
- Grupos: botão direito → **Create group**, com ou sem seleção prévia; duplo clique no nome renomeia.
- Atalhos: `Alt`/`Option`+arrasto **duplica** a seleção · `Shift`+arrasto restringe a **um eixo** · `Space` durante mover ou redimensionar **desativa o snapping** · `Shift` ao redimensionar mantém a proporção · `Ctrl+a`/`Cmd+a` seleciona tudo · `Shift+1` **zoom to fit** · `Shift+2` **zoom to selection**.
- Navegação: `Space`+arrasto ou botão do meio para pan; scroll para pan vertical, `Shift`+scroll para horizontal; `Space` ou `Ctrl`/`Cmd`+scroll para zoom.
- Embed com `![[My canvas.canvas]]` — o embed **mostra as shapes, mas não o texto dos cards**; para ver tudo, abra o canvas.
- `.canvas` é um dos **dois únicos formatos restauráveis** por [[File Recovery]] — o outro é `.md`.

## Comparação

| | Canvas | [[Base (Obsidian Bases)]] |
|---|---|---|
| Organização | Espacial e manual | Declarativa e consultiva |
| O que carrega sentido | Posição, adjacência, aresta rotulada | Property, filtro, fórmula |
| Atualização | Você move | O resultado se recalcula |
| Formato | `.canvas` (JSON Canvas) | `.base` (YAML) ou code block |
| Bom para | Ideia em formação, argumento, mapa de leitura | Coleção estável com atributos |
| Backlinks | Só depois de converter o card em arquivo | Derivados dos arquivos consultados |

## Veja também

- [[Internal Link (Wikilink)]]
- [[Embed (Transclusão)]]
- [[File Recovery]]
- [[Base (Obsidian Bases)]]
- [[Data Portability]]
- [[Attachment]]
