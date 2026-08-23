---
title: Alias (Obsidian)
aliases:
  - Alias
  - Aliases
  - Nome Alternativo
tags:
  - obsidian
  - linking
  - markdown
  - pkm
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Alias** é um nome alternativo para uma nota, declarado na property `aliases`, que passa a resolver links, sugestões e menções como se fosse o nome do arquivo.

## Conceito

O nome do arquivo é o identificador da nota, e identificador único não comporta as várias formas pelas quais você se refere a um assunto. O alias resolve isso sem duplicar nota nem renomear arquivo: acrônimos, apelidos e o mesmo conceito em outro idioma passam a apontar para o mesmo destino.

A diferença de escopo em relação ao display text de um link é a distinção que mais se confunde: display text muda **um link, num lugar**; alias muda **como o vault inteiro te entende**.

## Sintaxe

```md
---
aliases:
  - Doggo
  - Woofer
  - Yapper
---

# Dog
```

O alias é sempre uma **lista YAML**. Ver [[Properties (Frontmatter)]].

## Características

- Digitando o alias dentro de `[[`, ele aparece nas sugestões com um **ícone de seta curva**; `Enter` seleciona.
- O link gravado é `[[Artificial Intelligence|AI]]`, **não** `[[AI]]`.

> [!quote]
> Rather than just using the alias as the link destination (`[[AI]]`), Obsidian uses the `[[Artificial Intelligence|AI]]` link format to ensure interoperability with other applications using the Wikilink format.

- Aliases alimentam as [[Unlinked Mention]]: definido `AI` como alias de `Artificial intelligence`, as menções de "AI" em outras notas aparecem no painel Backlinks. Ao converter, o alias vira display text.
- O Quick switcher busca **por nome ou alias** (`Ctrl+O` / `Cmd+O`).
- Em [[Search Syntax (Obsidian)]]: `[aliases]` retorna arquivos que têm a property; `[aliases:Name]` filtra pelo valor; `[aliases:null]` acha a property presente e vazia (não cobre `""` nem `[]`).
- Em [[Obsidian Publish]], o alias funciona como **redirect**: para redirecionar `/Guides/Making+friends` para a nota nova, o alias precisa conter o **caminho completo** da nota antiga (`Guides/Making friends`) — só o nome funciona no vault local, mas não no Publish.
- O Format converter migra o formato deprecado `alias: X` para a lista `aliases:`.

> [!tip]
> Use display text quando quiser mudar a aparência de um link *num lugar específico*. Use alias quando quiser se referir à mesma nota por *nomes diferentes* ao longo do vault.

## Comparação

| | Alias | Display text (`\|`) |
|---|---|---|
| Onde vive | Frontmatter da nota destino | Dentro de um link, na nota origem |
| Escopo | Vault inteiro | Aquela ocorrência |
| Gera unlinked mentions | Sim | Não |
| Resolve no Quick switcher | Sim | Não |
| Consultável | `[aliases:Name]` | Não |

## Veja também

- [[Internal Link (Wikilink)]]
- [[Properties (Frontmatter)]]
- [[Unlinked Mention]]
- [[Search Syntax (Obsidian)]]
- [[Unique Note (Zettelkasten Prefix)]]
