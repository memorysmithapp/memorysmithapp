---
title: Obsidian Flavored Markdown (OFM)
aliases:
  - OFM
  - Obsidian Markdown
tags:
  - obsidian
  - markdown
  - linking
  - note-taking
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Obsidian Flavored Markdown** é a combinação de dialetos Markdown adotada pelo Obsidian — CommonMark, GitHub Flavored Markdown e LaTeX — acrescida de um conjunto declarado de extensões próprias.

## Conceito

O objetivo declarado é máxima capacidade sem quebrar formatos existentes: em vez de inventar uma linguagem, o Obsidian empilha padrões conhecidos e adiciona apenas o que o modelo de vault exige — links internos, embeds, referências de bloco e [[Callout|callouts]]. Uma nota escrita em OFM continua sendo Markdown válido para as partes padrão, o que sustenta a [[Data Portability]] defendida pelo [[Local-first]].

O que **não** é OFM também define o conceito. HTML é suportado mas sanitizado, e existe uma regra dura de parser que surpreende quem vem de outros editores.

> [!important] Markdown não é processado dentro de HTML
> `Obsidian does not render Markdown syntax inside HTML elements.` É uma escolha intencional de projeto, por otimização de desempenho e para manter baixa a complexidade do parser em documentos grandes. Ou seja: `**bold**` e `` `code` `` não são processados dentro de `<div>`, `<span>`, `<table>` ou qualquer outra tag.

Quando `<span>` ou `<a>` parecem renderizar Markdown, o que acontece é que o Markdown foi processado *fora* do contexto HTML — não dentro dele.

## Sintaxe — extensões suportadas

| Sintaxe | Descrição |
|---|---|
| `[[Link]]` | [[Internal Link (Wikilink)\|Internal links]] |
| `![[Link]]` | [[Embed (Transclusão)\|Embed files]] |
| `![[Link#^id]]` | [[Block Reference\|Block references]] |
| `^id` | Definição de um bloco |
| `[^id]` | Footnotes |
| `%%Text%%` | Comentários |
| `~~Text~~` | Strikethrough |
| `==Text==` | Highlight |
| ` ``` ` | Code blocks |
| `- [ ]` | Tarefa incompleta |
| `- [x]` | Tarefa concluída |
| `> [!note]` | [[Callout\|Callouts]] |
| (ver link) | Tabelas |

## Características

- **Blocos HTML precisam ser self-contained**: devem estar completos e **não podem conter linhas em branco internas** — uma linha em branco quebra o bloco
- HTML é *sanitizado*: `<script>` e afins são neutralizados para impedir execução de código malicioso
- **Math por MathJax** em notação LaTeX: `$e^{2i\pi} = 1$` inline e `$$ ... $$` em bloco
- **Diagramas por Mermaid** em code block `mermaid`; para transformar nós em links internos, aplique a classe `internal-link` aos nós
- Syntax highlighting por Prism nos code blocks

> [!warning] Links de diagrama não entram no grafo
> Internal links criados dentro de diagramas Mermaid **não aparecem na** [[Graph View|Graph view]]. O link navega, mas não conta como aresta de conhecimento.

## Comparação

| | GitHub Flavored Markdown | Obsidian Flavored Markdown |
|---|---|---|
| Base | CommonMark | CommonMark + GFM + LaTeX |
| Link entre documentos | Caminho relativo em Markdown | Também `[[Wikilink]]` resolvido no vault |
| Transclusão | Não tem | `![[Nota]]`, `![[Nota#Heading]]`, `![[Nota#^id]]` |
| Endereço de bloco | Não tem | `^id` |
| Destaque | Não padronizado | `==Text==` |
| Comentário oculto | HTML comment | `%%Text%%` |
| Blocos de aviso | Alerts do GitHub | [[Callout\|Callouts]] com tipos e CSS |
| Markdown dentro de HTML | Parcialmente processado | Não processado |

## Veja também

- [[Callout]]
- [[Internal Link (Wikilink)]]
- [[Embed (Transclusão)]]
- [[Block Reference]]
- [[Live Preview]]
