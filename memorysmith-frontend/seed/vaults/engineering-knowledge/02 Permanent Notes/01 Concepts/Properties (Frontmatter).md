---
title: Properties (Frontmatter)
aliases:
  - Frontmatter
  - YAML Front Matter
  - Propriedades
  - Metadados de Nota
tags:
  - obsidian
  - markdown
  - database
  - pkm
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Properties** são dados estruturados sobre uma nota — texto, links, datas, checkboxes e números — armazenados em um bloco YAML no topo do arquivo, o *frontmatter*.

## Conceito

O corpo de uma nota é prosa; o frontmatter é a parte consultável dela. É o que permite que uma coleção de arquivos de texto se comporte como base de dados sem deixar de ser texto — a fundação sobre a qual [[Base (Obsidian Bases)|Bases]], busca por propriedade e community plugins operam.

A restrição mais importante é de escopo **vault-wide**: *once a property type is assigned to a property name, all properties with that name across your vault will use the same type*. Não existe `status` como texto numa nota e como lista em outra — o nome carrega o tipo para todo o vault, o que força um vocabulário de propriedades disciplinado. Cada nome deve ser único dentro de uma nota, mas a ordem dos pares nome-valor é irrelevante.

## Sintaxe

```yaml
---
title: A New Hope            # Text
cast:                        # List
  - Mark Hamill
  - Harrison Ford
year: 1977                   # Number
favorite: true               # Checkbox
date: 2020-08-21             # Date
time: 2020-08-21T10:30:00    # Date & time
tags:                        # Tags
  - journal
  - personal
link: "[[Episode IV]]"
---
```

## Características

- **Formas de adicionar**: hotkey `Cmd/Ctrl+;`, comando **Add file property**, menu **More actions**, ou digitar `---` no começo absoluto do arquivo
- **Sete tipos**: Text, List, Number, Checkbox, Date, Date & time e Tags. O tipo Tags é exclusivo da property `tags`
- Number precisa ser um **número literal** — inteiro ou decimal —, nunca uma expressão com operadores
- [[Internal Link (Wikilink)|Internal links]] em properties **precisam de aspas**: `link: "[[Episode IV]]"`. O Obsidian as adiciona ao digitar, mas plugins de template podem não fazê-lo
- Markdown não é renderizado em Text properties, e hashtags ali **não criam tags**
- **JSON é aceito**, mas é lido, interpretado e **salvo como YAML**
- Com o plugin [[Daily Note|Daily notes]] ativo, uma property Date funciona também como link para a daily note daquela data
- **Display modes** em Settings → Editor → Properties in document: **Visible** (padrão), **Hidden** (ainda visível via Properties view) e **Source** (YAML cru)

## Properties padrão

| Property | Tipo | Papel |
|---|---|---|
| `tags` | List | Ver [[Tag (Obsidian)]] |
| `aliases` | List | Ver [[Alias (Obsidian)]] |
| `cssclasses` | List | Estiliza notas individuais via [[CSS Snippet]] |

Para [[Obsidian Publish]]: `publish`, `permalink`, `description`, `image` e `cover`.

> [!warning] Properties depreciadas
> `tag`, `alias` e `cssclass` foram depreciadas na versão 1.4 e o suporte como properties padrão foi removido na 1.9. Use as formas no plural.

> [!important] O que não é suportado
> **Nested properties** (para vê-las, a recomendação é usar o Source mode), **bulk-editing** fora da Properties view, e **Markdown em properties** — este último com justificativa explícita: *properties are meant for small, atomic bits of information that are both human and machine readable*.

## Comparação

| | Property `tags` | Tag inline `#tag` |
|---|---|---|
| Onde vive | Bloco YAML no topo | Qualquer ponto do corpo |
| Formato | Sempre lista, um item por linha com `- ` | Palavra iniciada por `#` |
| Contexto | Classifica a nota inteira | Marca o ponto onde aparece |
| Consultável por Bases | Sim, como property | Via `file.hasTag` |
| Em Text property | — | Hashtag ali não cria tag |

## Veja também

- [[Base (Obsidian Bases)]]
- [[Tag (Obsidian)]]
- [[Alias (Obsidian)]]
- [[Escrever Frontmatter Consultável]]
- [[Live Preview]]
