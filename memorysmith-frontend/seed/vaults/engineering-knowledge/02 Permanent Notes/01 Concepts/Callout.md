---
title: Callout
aliases:
  - Admonition
  - Bloco de Destaque
tags:
  - obsidian
  - markdown
  - css
  - ui
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> Um **callout** é um blockquote cuja primeira linha começa com um *type identifier* entre `[!` e `]`, usado para incluir conteúdo adicional sem quebrar o fluxo da nota.

## Conceito

O callout é a menor extensão possível sobre uma sintaxe existente: ele não inventa um bloco novo, apenas reinterpreta o blockquote quando encontra um identificador na primeira linha. É por isso que qualquer editor Markdown ainda exibe o conteúdo — degradado para citação, mas legível. Ver [[Obsidian Flavored Markdown (OFM)]].

Um callout suporta Markdown, [[Internal Link (Wikilink)|wikilinks]] e [[Embed (Transclusão)|embeds]] no corpo, e é suportado nativamente no [[Obsidian Publish]].

## Sintaxe

```markdown
> [!info] Here's a callout title
> Here's a callout block.
> It supports **Markdown**, [[Wikilinks]], and embeds!

> [!tip] Title-only callout

> [!faq]- Are callouts foldable?
> Contents are hidden when collapsed.

> [!question] Can callouts be nested?
> > [!todo] Yes!, they can.
> > > [!example] You can even use multiple layers of nesting.
```

## Características

- O **título padrão é o type identifier em title case**; qualquer texto após o identificador substitui o título
- Omitir o corpo produz um callout só de título
- `+` ou `-` **colados ao identificador** tornam o callout dobrável: `+` expande por padrão, `-` recolhe
- Aninhamento por níveis de `>`, sem limite declarado de profundidade
- O identificador é **case-insensitive**; qualquer tipo não suportado cai no tipo `note`
- Comando **Insert callout** insere um `[!note]` com o cursor no campo do nome; com texto selecionado — inclusive listas e code blocks — o comando **envolve a seleção** no callout
- Em [[Live Preview]], clique com o botão direito no nome do callout para trocar o tipo

## Tipos suportados

| Type identifier | Aliases |
|---|---|
| `note` | — |
| `abstract` | `summary`, `tldr` |
| `info` | — |
| `todo` | — |
| `tip` | `hint`, `important` |
| `success` | `check`, `done` |
| `question` | `help`, `faq` |
| `warning` | `caution`, `attention` |
| `failure` | `fail`, `missing` |
| `danger` | `error` |
| `bug` | — |
| `example` | — |
| `quote` | `cite` |

## Customização por CSS

[[CSS Snippet|CSS snippets]] e community plugins podem definir callouts personalizados ou sobrescrever a configuração padrão. O seletor usa o atributo `data-callout`, cujo valor é o identificador que você quer usar:

```css
.callout[data-callout="custom-question-type"] {
    --callout-color: #000000;
    --callout-icon: lucide-alert-circle;
}
```

- `--callout-color` define a cor de fundo; qualquer cor CSS válida serve, como hex ou `rgb()`
- `--callout-icon` aceita um ID de ícone do lucide.dev **ou** um elemento SVG inline: `--callout-icon: '<svg>...custom svg...</svg>';`

> [!warning] Versão dos ícones Lucide
> O Obsidian atualiza os ícones Lucide periodicamente. Use apenas ícones da versão incluída no app ou anteriores.

## Comparação

| | Blockquote | Callout |
|---|---|---|
| Sintaxe | `>` na primeira coluna | `>` + `[!type]` na primeira linha |
| Título | Não tem | Type identifier em title case, ou custom |
| Dobrável | Não | Sim, com `+` ou `-` |
| Estilo | Uniforme | Cor e ícone por tipo, customizáveis por CSS |
| Fora do Obsidian | Renderiza normal | Degrada para blockquote com o texto `[!type]` visível |

## Veja também

- [[Obsidian Flavored Markdown (OFM)]]
- [[CSS Snippet]]
- [[Live Preview]]
- [[Theme (Obsidian)]]
