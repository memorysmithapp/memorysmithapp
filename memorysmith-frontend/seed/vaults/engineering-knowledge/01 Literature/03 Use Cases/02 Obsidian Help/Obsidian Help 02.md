---
title: Obsidian Help 02
aliases:
  - Obsidian Help — Escrita, Markdown e Formatação
tags:
  - obsidian
  - pkm
  - literature
  - markdown
  - note-taking
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 02 — Escrita, Markdown e Formatação

*Obsidian Flavored Markdown · Basic e Advanced formatting syntax · Properties · Callouts · Tags · Views and editing mode · Attachments · HTML content · Embed web pages · Folding · Editing shortcuts · Multiple cursors*

## Resumo executivo

O eixo da escrita responde a uma pergunta só: **quanto de estrutura cabe em texto puro sem que ele deixe de ser texto puro?** A resposta: um dialeto fechado sobre padrões existentes, metadados tipados no topo do arquivo, um vocabulário semântico de blocos e três estados de visualização — com as limitações rotuladas como projeto.

## Principais ideias

### OFM é composição de padrões mais extensões enumeráveis

*"Obsidian strives for maximum capability without breaking any existing formats."* A base é CommonMark + GFM + LaTeX; sobre ela a doc tabula as extensões próprias uma a uma — `[[Link]]`, `![[Link]]`, `![[Link#^id]]`, `^id`, `[^id]`, `%%Text%%`, `~~Text~~`, `==Text==`, code blocks, `- [ ]`, `- [x]`, `> [!note]` e tabelas. A lista é enumerável, e é isso que mantém o arquivo legível fora do app. A regra mais consequente é negativa: Markdown **não** é renderizado dentro de HTML — e blocos HTML devem ser autocontidos, porque uma linha em branco no meio quebra o bloco. Todo HTML é sanitizado. Ver [[Obsidian Flavored Markdown (OFM)]].

### Properties é a camada de identidade tipada da nota

Frontmatter em YAML — ou JSON, *"read, interpreted, and saved as YAML"* — com sete tipos: Text, List, Number, Checkbox, Date, Date & time e Tags. A regra que transforma frontmatter em esquema: *"Once a property type is assigned to a property name, all properties with that name across your vault will use the same type."* Nomear um campo é, portanto, decisão global. Nomes são únicos na nota, Number exige literal, wikilinks precisam de aspas (`link: "[[Episode IV]]"`), e as defaults são `tags`, `aliases` e `cssclasses` — `tag`, `alias`, `cssclass` depreciadas na 1.4, sem suporte na 1.9. Ficam fora nested properties, bulk-edit e Markdown, este por decisão declarada. Ver [[Properties (Frontmatter)]] e [[Escrever Frontmatter Consultável]].

### Callouts são vocabulário semântico, não enfeite

O callout é um blockquote cujo primeiro token é um *type identifier*, e é ele, não a cor, que carrega significado. São 13 tipos nativos (`note`, `abstract`, `info`, `todo`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `bug`, `example`, `quote`) mais aliases como `tldr`, `faq`, `caution` e `cite`. O identificador é case-insensitive e todo tipo desconhecido cai em `note`, o que permite convenção própria sem quebrar a renderização. `+` deixa expandido, `-` recolhido; título e corpo são opcionais; aninhar é livre. A extensão formal é CSS: `.callout[data-callout="custom-question-type"]` com `--callout-color` e `--callout-icon` (Lucide ou SVG). Ver [[Callout]] e [[Tag (Obsidian)]].

### Os três estados de visualização são fases do trabalho

*Views* alternam ler e editar; *modes* definem como o Markdown aparece na edição. **Reading view** esconde a sintaxe, **Live Preview** formata inline e revela o cru sob o cursor, **Source mode** mostra tudo literal; `Ctrl/Cmd+E` alterna, e `Ctrl/Cmd`+clique abre a nota nos dois estados. As dependências listadas impedem tratar isso como preferência estética: inline footnotes (`^[texto]`) só funcionam em reading view; PrismJS não colore código em Source mode nem em Live Preview; editar tabela por menu de contexto só existe em Live Preview; e templates pedem Source mode, porque *Properties in document* sobrescreve variáveis sem aspas. Ver [[Live Preview]].

### Diagrama e matemática viram texto versionável

Mermaid e MathJax entram como code block e inline (`$e^{2i\pi} = 1$`), mantendo diagrama e fórmula diffáveis com a prosa. Nós de Mermaid viram links com a classe `internal-link` — mas a doc registra o custo: *"Internal links from diagrams don't show up in the Graph view."* A ligação existe para o leitor, não para a topologia — mesmo padrão dos text cards do [[Canvas]]. Anexos, em contraste, são arquivos: [[Attachment]] vão para a **Default location for new attachments** (raiz, pasta fixa, pasta da nota ou subpasta) e são redimensionáveis no embed, `![[Engelbart.jpg|100x145]]`.

## Conceitos apresentados

- [[Obsidian Flavored Markdown (OFM)]] — CommonMark + GFM + LaTeX + extensões
- [[Callout]] — os 13 tipos e a extensão por `data-callout`
- [[Properties (Frontmatter)]] — sete tipos, tipagem vault-wide por nome
- [[Tag (Obsidian)]] — `#tag` inline ou lista em `tags`, aninhada por `/`
- [[Live Preview]] — o estado intermediário e suas dependências
- [[Attachment]] — arquivo real, com localização configurável
- [[Escrever Frontmatter Consultável]] — a prática destilada daqui

## Exemplos

> [!quote] Obsidian Flavored Markdown — a regra dura
> *"Obsidian does not render Markdown syntax inside HTML elements. This is an intentional design choice for performance optimization and to keep parser complexity low."*

> [!quote] Properties — por que não há Markdown no frontmatter
> *"Properties are meant for small, atomic bits of information that are both human and machine readable."*

---
Ref: [[Obsidian Help]], [[Obsidian Flavored Markdown (OFM)]], [[Properties (Frontmatter)]], [[Callout]], [[Escrever Frontmatter Consultável]]
