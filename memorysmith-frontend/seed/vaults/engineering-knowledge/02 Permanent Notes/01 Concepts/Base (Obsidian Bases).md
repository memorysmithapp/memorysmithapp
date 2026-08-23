---
title: Base (Obsidian Bases)
aliases:
  - Bases
  - Base File
  - .base
  - Database View
tags:
  - obsidian
  - database
  - plugin
  - search
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Base** é o core plugin que cria views tipo banco de dados sobre as notas do vault — tabelas, cards, listas e mapas que exibem, editam, ordenam e filtram arquivos pelas suas [[Properties (Frontmatter)|properties]].

## Conceito

O ponto que define o desenho: **todo o dado continua nos arquivos Markdown e nas suas properties**. A base não guarda registros; ela guarda a *descrição de uma consulta e de sua renderização*, persistida como arquivo `.base` (YAML válido) ou embutida num code block ` ```base ` dentro de uma nota. Apagar a base não perde nada.

> [!important]
> Não existe `from` nem `source` como em SQL ou Dataview. Por padrão **a base inclui todo arquivo do vault**; a restrição vem exclusivamente da seção `filters`.

## Sintaxe

```yaml
filters:
  and:
    - file.hasTag("book")
formulas:
  ppu: "(price / age).toFixed(2)"
properties:
  formula.ppu:
    displayName: "Preço por unidade"
summaries:
  customAverage: 'values.mean().round(3)'
views:
  - type: table
    name: "My table"
    limit: 10
    groupBy:
      property: note.age
      direction: DESC
    order:
      - file.name
      - formula.ppu
```

Filtros existem em dois níveis — global (`filters` de topo, vale para todas as views) e por view — e são concatenados com `AND` na avaliação. Um filtro é uma comparação aritmética ou uma função, combináveis recursivamente por `and`, `or` e `not`.

## Características

- **Três famílias de property**: `note.` (frontmatter, só em Markdown; sem prefixo assume-se `note`), `file.` (vale para qualquer [[Attachment|tipo de arquivo]] — `file.name`, `file.ext`, `file.folder`, `file.path`, `file.size`, `file.ctime`, `file.mtime`, `file.tags`, `file.links`, `file.embeds`, `file.backlinks`, `file.properties`) e `formula.` (outras fórmulas da própria base, sem referência circular).
- **Objeto `this`**, com três comportamentos: na área principal aponta para a própria base (`this.file.folder`); embutida, aponta para o **arquivo que embute** (`this.file.name`); no sidebar, aponta para o arquivo **ativo** na área principal — daí `file.hasLink(this.file)` replicar o painel de [[Backlink|backlinks]].
- **Operadores**: aritméticos `+ - * / %`, comparação `== != > < >= <=`, booleanos `! && ||`.
- **Aritmética de duração**: `y`, `M`, `d`, `w`, `h`, `m`, `s`. Atenção — `M` é **mês** e `m` é **minuto**. `date + "1M"` soma um mês; `file.mtime > now() - "1 week"` testa modificação na última semana; subtrair duas datas devolve a diferença em milissegundos.
- **Funções** por categoria: globais (`date()`, `duration()`, `if()`, `link()`, `list()`, `min()`, `max()`, `now()`, `today()`, `number()`, `image()`, `icon()`, `html()`, `file()`, `random()`, `escapeHTML()`), de qualquer tipo (`isTruthy()`, `isType()`, `toString()`), de Date (`format()`, `time()`, `relative()`, `date()`), de String (`contains()`, `slice()`, `split()`, `replace()`, `lower()`, `title()`, `trim()`, `startsWith()`, `endsWith()`), de Number (`abs()`, `round()`, `floor()`, `ceil()`, `toFixed()`), de List (`filter()`, `join()`, `flat()`, `contains()`), além de Link, File, Object e Regular expression. O comportamento segue o do JavaScript.
- **Summaries** agregam uma property sobre o result set: Average, Min, Max, Sum, Range, Median, Stddev, Earliest, Latest, Checked, Unchecked, Empty, Filled, Unique — mais fórmulas próprias sobre a palavra-chave `values`.
- Embed: `![[File.base]]`, ou `![[File.base#View]]` para escolher a view default.

## Layouts

| Layout | O que exibe | Versão |
|---|---|---|
| Table | Linhas por arquivo, colunas por property; altura de linha short/medium/tall/extra tall | 1.9 |
| Cards | Grade tipo galeria, com imagem de capa opcional vinda de uma property | 1.9 |
| List | Lista com marcadores de bullet, número ou nenhum | 1.10 |
| Map | Pins num mapa interativo; **exige o plugin community Maps**, mantido pela equipe | 1.10 |

## Comparação

| | Filter | Formula |
|---|---|---|
| Papel | Decide **quais** arquivos entram | Calcula um **novo valor** por arquivo |
| Resultado | Booleano | Valor de qualquer tipo |
| Onde vive | `filters`, global ou por view | `formulas`, referenciável como `formula.nome` |
| Escopo | Result set | Linha a linha |
| Sintaxe | A mesma — mesmas funções e operadores | A mesma |

## Veja também

- [[Properties (Frontmatter)]]
- [[Search Syntax (Obsidian)]]
- [[Canvas]]
- [[Tag (Obsidian)]]
- [[Modelar uma Base sobre o Frontmatter]]
- [[Obsidian Plugin]]
