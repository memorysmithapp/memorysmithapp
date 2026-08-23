---
title: Tag (Obsidian)
aliases:
  - Tag
  - Hashtag
  - Nested Tag
tags:
  - obsidian
  - pkm
  - search
  - note-taking
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> Uma **tag** é uma palavra-chave iniciada por `#` que ajuda a encontrar rapidamente as notas de um assunto — declarada inline no corpo da nota ou pela property `tags`.

## Conceito

Tags e links resolvem problemas diferentes. Um [[Internal Link (Wikilink)|internal link]] afirma uma relação entre *duas coisas específicas*; uma tag afirma que uma nota pertence a *uma categoria*. A tag não cria aresta no grafo de conhecimento — ela cria um conjunto.

A doc reconhece as duas formas de declaração como equivalentes em função: `#meeting` escrito no corpo e `tags: [- meeting]` no frontmatter produzem a mesma capacidade de busca. A diferença é de escopo: a property classifica a nota inteira; a tag inline marca o ponto exato onde o assunto aparece.

## Sintaxe

```markdown
Reunião de kickoff com o time. #meeting #inbox/to-read
```

```yaml
---
tags:
  - recipe
  - cooking
---
```

## Características

- Criada inline com `#` seguido de palavra-chave, ou pela property `tags` — que **sempre** deve ser formatada como lista
- **Nested tags** por barra `/`: `#inbox/to-read`, `#inbox/processing`
- Caracteres permitidos: letras, números, underscore `_`, hífen `-`, barra `/` e caracteres Unicode comumente aceitos, incluindo emojis
- **Precisa conter ao menos um caractere não-numérico**: `#1984` não é uma tag válida, mas `#y1984` é
- **Case-insensitive** — `#tag` e `#TAG` são tratadas como idênticas — porém a Tags view **exibe a grafia da primeira criação**: criar `#Tag` e depois `#TAG` exibe `#Tag` para ambas
- Não pode conter espaços em branco; para separar palavras, use `#camelCase`, `#PascalCase`, `#snake_case` ou `#kebab-case`
- Busca por `tag:#meeting` na [[Search Syntax (Obsidian)|Search]], ou clicando na tag dentro da nota

## Comportamento das nested tags

O prefixo é hierárquico em todos os lugares onde a tag é consultada:

- Na **Search**, `tag:inbox` casa com `#inbox` e com todas as filhas, como `#inbox/to-read`
- Na **Tags view**, as filhas aparecem como pertencentes à tag pai
- Em [[Base (Obsidian Bases)|Bases]], a função `hasTag` reconhece a hierarquia: `file.hasTag("a")` casa tanto com `#a` quanto com `#a/b`

## Tags view

Core plugin que lista todas as tags do vault e o número de notas de cada uma.

- Clicar numa tag dispara a busca por ela; **`Ctrl`+clique** (`Cmd` no macOS) **alterna** a tag no termo de busca
- **Change sort order**: por **Tag name** ou por **Frequency**
- **Show nested tags** alterna entre árvore e lista plana; **Expand all** e **Collapse all** operam a hierarquia inteira, e cada nível pode ser expandido individualmente

## Comparação

| | Tag | [[Internal Link (Wikilink)]] |
|---|---|---|
| Afirma | Pertencimento a uma categoria | Relação entre dois documentos |
| Sintaxe | `#tag` ou property `tags` | `[[Nota]]` |
| Cria nó de destino | Não | Sim — a nota existe ou pode ser criada |
| Aparece na [[Graph View]] | Não como aresta entre notas | Sim, como aresta |
| Gera [[Backlink\|backlinks]] | Não | Sim |
| Hierarquia | Sim, por `/` | Por pasta ou por convenção de nome |
| Granularidade | Nota, ou ponto do texto | Nota, heading ou bloco |

## Veja também

- [[Properties (Frontmatter)]]
- [[Internal Link (Wikilink)]]
- [[Search Syntax (Obsidian)]]
- [[Base (Obsidian Bases)]]
