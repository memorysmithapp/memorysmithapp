---
title: Search Syntax (Obsidian)
aliases:
  - Search Query
  - Sintaxe de Busca
  - Operadores de Busca
tags:
  - obsidian
  - search
  - pkm
  - markdown
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Search syntax** é a gramática de termos, operadores e expressões regulares do core plugin Search — e a mesma gramática alimenta o filtro do painel [[Backlink|Backlinks]], os filtros e grupos do [[Graph View]] e as buscas salvas nos bookmarks.

## Conceito

Uma busca no Obsidian é uma consulta **ad hoc**: você escreve, lê o resultado, descarta. Aprender a gramática compensa porque ela reaparece em três outros lugares — o que você aprende para achar uma nota serve para colorir um grupo no grafo e para filtrar um painel de backlinks.

Acesso: ícone no sidebar esquerdo ou `Ctrl+Shift+F` (Windows/Linux) / `Command+Shift+F` (macOS). Com texto selecionado no editor, o atalho já busca a seleção. Com o campo vazio, lista os **termos recentes**. O Search percorre o conteúdo de notas e canvases; para paths e nomes de qualquer arquivo, use `path:` ou `file:`.

## Sintaxe

```
meeting work                 AND implícito
meeting OR work              alternativa
meeting (work OR meetup) personal    parênteses controlam prioridade
meeting -work                negação
meeting -(work meetup)       nega a combinação
"star wars"                  frase exata
"they said \"hello\" to each other"   escape de aspas internas
meeting [duration:<5]        < e > só dentro de [] ou ""
/\d{4}-\d{2}-\d{2}/          regex entre barras
path:/\d{4}-\d{2}-\d{2}/     regex combinada com operador
task:(call OR email)         sub-termo aninhado
```

## Operadores

| Operador | O que faz |
|---|---|
| `file:` | Texto no nome do arquivo, qualquer arquivo do vault. `file:.jpg`, `file:202209` |
| `path:` | Texto no caminho, qualquer arquivo. `path:"Daily notes/2022-07"` |
| `content:` | Texto no conteúdo. `content:"happy cat"` |
| `match-case:` | Casamento sensível a maiúsculas. `match-case:HappyCat` |
| `ignore-case:` | Casamento insensível. `ignore-case:ikea` |
| `tag:` | Tag no arquivo. `tag:#work` não retorna `#myjob/work`. Ignora code blocks e conteúdo não-Markdown — **mais rápido e mais preciso** que full-text |
| `line:` | Arquivos com ao menos uma linha que casa. `line:(mix flour)`; `-line` inverte |
| `block:` | Casamento no mesmo bloco. `block:(dog cat)`. **Exige parsear o Markdown de cada arquivo — lento** |
| `section:` | Casamento na mesma seção, entre dois cabeçalhos. `section:(dog cat)` |
| `task:` | Casamento numa task, bloco a bloco. `task:call` |
| `task-todo:` | Casamento em task **não concluída** |
| `task-done:` | Casamento em task **concluída** |

## Properties

`[property]` retorna arquivos com a property; `[property:value]` filtra pelo valor; `[property:null]` acha a property presente e vazia.

> [!warning]
> `null` funciona quando a property está vazia (`aliases: `), mas **não** quando contém aspas vazias (`""`) nem colchetes vazios (`[]`).

Property e valor aceitam sub-queries: parênteses, `OR`, aspas e regex — `[status:Draft OR Published]`. Ver [[Properties (Frontmatter)]].

## Características

- **Explain search term** decompõe o termo complexo em texto simples; **Collapse results** e **Show more context** controlam a exibição.
- Regex usa o sabor **JavaScript**.
- **Match case** alterna sensibilidade direto na barra.
- Ordenação: File name A→Z / Z→A, Modified time novo→velho / velho→novo, Created time novo→velho / velho→novo. Default: File name (A to Z).
- **Copy search results** fica nos três pontos ao lado do número de resultados.
- Resultados podem ser embutidos numa nota com um code block ```` ```query ```` — não suportado no [[Obsidian Publish]].
- Arquivos em **Excluded files** não aparecem nos resultados.

## Comparação

| | Search | [[Base (Obsidian Bases)]] |
|---|---|---|
| Natureza | Consulta ad hoc, descartável | Consulta persistida em `.base` |
| Insumo | Texto, tags, paths, properties | Properties, file properties, formulas |
| Saída | Lista de trechos | Table, cards, list, map |
| Persistência | Bookmark ou code block `query` | Arquivo do vault, com várias views |
| Edição do resultado | Não | Sim, direto na view |

## Veja também

- [[Properties (Frontmatter)]]
- [[Base (Obsidian Bases)]]
- [[Graph View]]
- [[Backlink]]
- [[Tag (Obsidian)]]
- [[Busca Avançada no Obsidian]]
