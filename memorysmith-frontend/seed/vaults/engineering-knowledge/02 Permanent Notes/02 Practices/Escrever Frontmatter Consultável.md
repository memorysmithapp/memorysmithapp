---
title: Escrever Frontmatter Consultável
aliases:
  - Frontmatter Consultável
  - Queryable Frontmatter
  - Escrever Properties
tags:
  - obsidian
  - pkm
  - markdown
  - search
  - note-taking
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Properties só valem a pena quando são consultáveis: o que se escreve no bloco YAML no topo da nota é o que a busca, as bases e os plugins conseguem filtrar depois. A prática consiste em escolher poucos nomes de property, fixar o tipo de cada um em nível de vault e padronizá-los por template — de modo que `tags`, `status` e `source` signifiquem sempre a mesma coisa em todas as notas.

## Dinâmica / Passo a Passo

1. **Adicione a primeira property** por um dos quatro caminhos: comando **Add file property**, hotkey `Cmd/Ctrl+;`, menu **More actions** (três pontos ou clique com o botão direito na aba) ou digitando `---` no começo absoluto do arquivo. Aparece uma linha com dois campos: o *nome* e o *valor*.
2. **Escolha o tipo** clicando no ícone ao lado do nome. Os tipos são Text, List, Number, Checkbox, Date, Date & time e Tags. O tipo Tags é exclusivo da property `tags` e não pode ser atribuído a outra.
3. **Navegue por teclado** enquanto o foco está numa property: `Tab` / `Down arrow` avança, `Shift+Tab` / `Up arrow` volta, `Left arrow` edita o nome, `Right arrow` edita o valor, `Escape` devolve o foco à property, `Cmd+Backspace` apaga e `Alt+Down arrow` pula para o editor.
4. **Confira o YAML em Source mode** — obrigatório para ver nested properties, que a interface não exibe. Alternativamente, mude **Settings → Editor → Properties in document** entre `Visible`, `Hidden` e `Source`.
5. **Padronize por template.** Ao inserir um template, todas as properties dele são adicionadas e mescladas com as que a nota já tinha. Edite o template em Source mode: em Live Preview o painel **Properties in document** pode sobrescrever variáveis sem aspas.
6. **Renomeie globalmente** clicando com o botão direito na property dentro da **All properties view** do core plugin Properties view — que também ordena por nome ou por frequência de uso e abre a busca com a sintaxe já preenchida.

## Regras

- **O tipo é vault-wide, colado ao nome.** Atribuiu um tipo a `status` numa nota, todas as properties chamadas `status` no vault passam a usá-lo. Escolher o nome é escolher o esquema.
- **Internal links dentro de properties precisam de aspas:** `link: "[[Episode IV]]"`, inclusive dentro de listas. O Obsidian adiciona sozinho quando você digita, mas plugins de templating não — e aí quebra silenciosamente.
- **Number aceita literal, não expressão.** `year: 1977` e `pie: 3.14` valem; qualquer coisa com operador, não.
- **Nested properties não são suportadas.** Para vê-las, a recomendação da doc é o source mode. Estruture em listas planas em vez de hierarquias.
- **Markdown não é renderizado em properties, e isso é proposital:** *"This is an intentional limitation as properties are meant for small, atomic bits of information that are both human and machine readable."* Hashtags em property de texto também não viram tags.
- **Cada nome é único dentro da nota.** Não existem duas `tags` no mesmo arquivo; a ordem dos pares nome-valor, essa sim, é irrelevante.
- **Bulk-editing não existe nativamente** fora da Properties view — a doc remete a VSCode, scripts e community plugins.
- **`tag`, `alias` e `cssclass` estão depreciados** desde a 1.4 e deixaram de ser default properties na 1.9; os corretos são `tags`, `aliases` e `cssclasses`.

## Exemplo

O frontmatter de uma nota permanente deste vault, escrito para ser filtrável por [[Busca Avançada no Obsidian]] e agregável por [[Modelar uma Base sobre o Frontmatter]]:

```yaml
---
title: Ligar Notas em Três Granularidades
aliases:
  - Linking Granularity
tags:
  - obsidian
  - linking
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
```

`type` e `status` são Text de vocabulário fechado — é isso que permite `[type:practice]` recuperar exatamente o conjunto certo. `created` é Date, não Text, senão a ordenação cronológica na base falha.

---
Ref: [[Properties (Frontmatter)]], [[Tag (Obsidian)]], [[Alias (Obsidian)]], [[Busca Avançada no Obsidian]], [[Modelar uma Base sobre o Frontmatter]], [[Metadata Cache]]
