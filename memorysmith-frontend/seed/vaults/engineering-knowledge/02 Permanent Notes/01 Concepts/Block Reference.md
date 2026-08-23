---
title: Block Reference
aliases:
  - Block Link
  - Block Identifier
  - Referência de Bloco
tags:
  - obsidian
  - linking
  - zettelkasten
  - markdown
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> Uma **block reference** é um link para uma unidade de texto específica dentro de uma nota — parágrafo, citação ou item de lista — endereçada por um identificador único no formato `[[Nota#^id]]`.

## Conceito

O Obsidian oferece três granularidades de endereçamento: a nota (`[[Nota]]`), o heading (`[[Nota#Cabeçalho]]`) e o bloco (`[[Nota#^id]]`). A terceira é a mais fina e a mais estável: um heading pode ser reescrito e quebrar o link, mas o `^id` é um endereço arbitrário, colado ao bloco, que sobrevive à edição do texto ao redor.

É aqui que o Obsidian encontra o [[Unique Note (Zettelkasten Prefix)|Zettelkasten]]. O número de fichário de Luhmann servia para que uma ficha pudesse ser citada por outra sem ambiguidade, independentemente de onde estivesse na gaveta. O `^id` cumpre a mesma função para uma proposição: dá **endereço estável a uma unidade de pensamento**, e é o que torna possível transcluir exatamente aquele trecho via [[Embed (Transclusão)|embed]] em qualquer outro lugar do vault.

## Sintaxe

Para *parágrafos simples*, o identificador vai no fim da linha, precedido de espaço e circunflexo:

```md
The quick purple gem dashes through the paragraph with blazing speed. ^37066d
```

Para *blocos estruturados* — listas, quotations, callouts e tabelas — o identificador vai em **linha separada, com uma linha em branco antes e depois**:

```md
> The quick purple gem dashes through the paragraph with blazing speed.

^37066f

This is the tale of Gemmy, the Unhelpful assistant.
```

E a referência:

```md
[[2023-01-01#^37066d]]
[[2023-01-01#^quote-of-the-day]]
```

## Características

- Ao digitar o circunflexo `^` dentro de um link, uma **lista de sugestões** aparece — não é preciso caçar o identificador manualmente
- Identificadores legíveis são permitidos: basta acrescentar espaço, `^` e o nome, como `^quote-of-the-day`
- Block identifiers só podem conter **letras latinas, números e hífens**
- Para *linhas específicas dentro de uma lista*, o identificador pode ser colocado diretamente no bullet point
- **Busca global de blocos** com a sintaxe `[[^^bloco]]`; a lista tende a ser bem mais longa que a de headings, porque muito mais coisas qualificam como bloco
- Um bloco é definido como uma unidade de texto: parágrafo, block quote ou item de lista

> [!warning] Não é suportado
> A doc é explícita: *We do not support links to specific parts of quotations, callouts, and tables.* Você endereça o bloco inteiro, nunca uma parte interna dele.

> [!warning] Interoperabilidade
> *Block references are specific to Obsidian and not part of the standard Markdown format. Links containing block references won't work outside of Obsidian.* É o ponto do vault onde a [[Data Portability]] é mais frágil: o texto continua legível, mas a referência não resolve fora do app.

## Comparação

| | Block Reference | Heading Link | Footnote |
|---|---|---|---|
| Sintaxe | `[[Nota#^id]]` | `[[Nota#Cabeçalho]]` | `[^id]` |
| Alvo | Um bloco arbitrário | Uma seção | Uma nota de rodapé no mesmo arquivo |
| Estabilidade | Alta — o id não muda com o texto | Quebra se o heading for reescrito | Local ao arquivo |
| Escopo | Entre notas do vault | Entre notas do vault | Dentro da nota |
| Busca global | `[[^^termo]]` | `[[## termo]]` | Footnotes view |
| Fora do Obsidian | Não funciona | Âncora comum de Markdown | Suportado por GFM |

## Veja também

- [[Internal Link (Wikilink)]]
- [[Embed (Transclusão)]]
- [[Unique Note (Zettelkasten Prefix)]]
- [[Obsidian Flavored Markdown (OFM)]]
- [[Ligar Notas em Três Granularidades]]
