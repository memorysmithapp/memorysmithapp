---
title: Obsidian Help 03
aliases:
  - Obsidian Help — Ligação, Grafo e Navegação
tags:
  - obsidian
  - pkm
  - literature
  - linking
  - graph
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 03 — Ligação, Grafo e Navegação

*Internal links · Embed files · Aliases · Link notes · Backlinks · Outgoing links · Graph view · Search · Quick switcher · Outline · Tags view · Bookmarks · Page preview · Random note · Footnotes view*

## Resumo executivo

Se o eixo anterior trata do que cabe dentro de uma nota, este trata do que existe **entre** notas. O link é premissa, não recurso — e daí decorrem três granularidades de endereçamento, uma inversão de direção mantida pelo sistema, um motor que sugere ligações não pedidas e um grafo de diagnóstico.

## Principais ideias

### "Links are first-class citizens" — em três granularidades

O alvo pode ser a nota inteira, um heading (`[[Nota#Seção]]`, encadeável com múltiplos `#`) ou um bloco — parágrafo, citação, item de lista — via `[[2023-01-01#^37066d]]`. O identificador de bloco nasce ao digitar `^` ou é escrito à mão (`^quote-of-the-day`, só letras latinas, números e hífens), no fim da linha em parágrafos simples e em linha isolada em blocos estruturados. Há busca vault-wide por alvo (`[[## termo]]`, `[[^^termo]]`) e o `!` prefixado converte referência em transclusão viva. Ressalva: *"block references are specific to Obsidian and not part of the standard Markdown format"*. Ver [[Internal Link (Wikilink)]], [[Block Reference]] e [[Embed (Transclusão)]].

### Backlinks automatizam a indexação que o fichário fazia à mão

*"A backlink for a note is a link from another note to that note."* O plugin trata a nota ativa como destino e lista quem aponta para ela, em **Linked mentions** e **Unlinked mentions**; Outgoing links faz o simétrico na origem. O ponto estrutural: nada disso é escrito no arquivo — a reversão é derivada do índice, e a nota-destino nunca precisa saber que é citada. Os backlinks também descem para o pé da nota ou viram aba fixada. Ver [[Backlink]].

### Unlinked mentions e aliases tornam a rede parcialmente emergente

Unlinked mentions listam ocorrências do nome — **ou de um alias** — de outra nota, sem link: *"Unlinked mentions helps you discover links you aren't aware of yet."* Um clique converte a menção; se o casamento veio de alias, o Obsidian escreve `[[Artificial Intelligence|AI]]` e nunca `[[AI]]`, *"to ensure interoperability with other applications"*. A distinção que a doc insiste em fazer: alias vale no vault inteiro; display text ajusta um link só. Ver [[Unlinked Mention]] e [[Alias (Obsidian)]].

### O Graph view é instrumento de diagnóstico

Círculos são notas, linhas são internal links, e o nó cresce com o número de referências recebidas. Fora dos ajustes de força e da animação cronológica, o valor está em duas lentes. **Orphans** expõe notas sem ligação alguma — captura que nunca foi costurada. **Existing files only**, desligado, mostra alvos de links para notas inexistentes: o backlog que o texto prometeu, já que *"a note doesn't need to exist to link to it"*. O **local graph** troca "como está o vault" por "o que orbita esta nota". Ver [[Graph View]] e [[Diagnóstico do Grafo de Conhecimento]].

### Search é substrato transversal, em quatro superfícies

A sintaxe não pertence ao painel de Search: alimenta filtros e Groups do [[Graph View]], o filtro de menções em Backlinks e os blocos ` ```query ` em notas. São doze operadores — `file:`, `path:`, `content:`, `match-case:`, `ignore-case:`, `tag:`, `line:`, `block:`, `section:`, `task:`, `task-todo:`, `task-done:` — mais booleanos (`OR`, `-`, parênteses), aspas para frase exata, colchetes para properties (`[status:Draft OR Published]`, `[aliases:null]`) e regex JavaScript-flavored. Dois têm custo anotado: `tag:` ignora code blocks e é *"faster and more accurate than a normal full-text search"*; `block:` obriga a parsear cada arquivo. Ver [[Search Syntax (Obsidian)]] e [[Busca Avançada no Obsidian]].

### A navegação se organiza em três camadas concêntricas

**Intra-nota**: Outline lista headings e reordena seções por drag; Footnotes view lista rodapés. **Inter-nota**: Quick switcher (`Ctrl/Cmd+O`) busca por nome ou alias, cria a nota se nada casar e degrada de algoritmo acima de **10.000 itens**; Page preview mostra conteúdo no hover; Bookmarks fixa arquivos, pastas, grafos, buscas, headings, blocos e links. **Topológica**: Graph view e Tags view, com contagem por tag. Ver [[Ligar Notas em Três Granularidades]].

## Conceitos apresentados

- [[Internal Link (Wikilink)]] — wikilink ou Markdown, atualizado no rename
- [[Block Reference]] — `#^id`, a mais fina e a menos portável
- [[Embed (Transclusão)]] — o `!` que troca referência por conteúdo vivo
- [[Backlink]] — inversão derivada do índice
- [[Unlinked Mention]] — ligação sugerida antes de alguém pedir
- [[Alias (Obsidian)]] — nome vault-wide, distinto do display text
- [[Graph View]] — Orphans e Existing files only como lentes
- [[Search Syntax (Obsidian)]] — operadores, properties e regex
- [[Ligar Notas em Três Granularidades]] — nota, heading e bloco
- [[Diagnóstico do Grafo de Conhecimento]] — ler o grafo como sintoma
- [[Busca Avançada no Obsidian]] — a prática sobre a gramática transversal

## Exemplos

> [!quote] Backlinks — o argumento por analogia
> *"Just imagine if you could list the backlinks for any website on the internet."*

> [!quote] Graph view — por que Existing files only existe
> *"Since a note doesn't need to exist to link to it, this can help limit your graph to notes that you actually have."*

---
Ref: [[Obsidian Help]], [[Internal Link (Wikilink)]], [[Backlink]], [[Graph View]], [[Ligar Notas em Três Granularidades]], [[Knowledge Graph]]
