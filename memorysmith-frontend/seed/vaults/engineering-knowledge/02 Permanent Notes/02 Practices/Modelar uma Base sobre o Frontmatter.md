---
title: Modelar uma Base sobre o Frontmatter
aliases:
  - Modelar uma Base
  - Bases sobre Properties
  - Design de Base
tags:
  - obsidian
  - database
  - pkm
  - search
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Uma base é uma vista de banco de dados construída sobre as properties que já existem nas notas — nada é armazenado nela além de filtros, formulas e configuração de views. Modelar uma base é, portanto, um exercício de leitura do frontmatter: quais properties recortam o conjunto certo, quais merecem virar coluna, e o que precisa ser calculado em vez de digitado.

## Dinâmica / Passo a Passo

1. **Crie a base** pela Command palette (**Bases: Create new base**, na mesma pasta do arquivo ativo, ou **Bases: Insert new base**, que já a embute na nota atual), pelo botão direito numa pasta no File explorer → **New base**, ou pelo item **Create new base** da ribbon.
2. **Defina os filtros.** No menu **Filter** há duas seções: **All views**, que se aplica a toda a base, e **This view**, só à view ativa. Cada filtro tem três componentes — **Property**, **Operator** (a lista depende do tipo) e **Value** (que aceita matemática e funções) — e as conjunções são **All the following are true** (`and`), **Any of the following are true** (`or`) e **None of the following are true** (`not`). Para o que a interface não expressa, o botão de código abre o **advanced filter editor** com a sintaxe crua.
3. **Escolha as properties visíveis** pelo menu **Properties** da toolbar; num table view, cada property vira coluna.
4. **Adicione formulas**: **Properties → Add formula**, nomeie, escreva a expressão e **espere o checkmark verde** — o editor autocompleta funções e nomes de property e valida a sintaxe. Depois disso a formula é usável como qualquer property: em views, filtros e ordenação.
5. **Ordene e agrupe** pelo menu **Sort**: vários critérios, reordenáveis pelo grip; agrupamento por **uma** property apenas.
6. **Adicione uma segunda view** pelo nome da view no canto superior esquerdo → **Add view**, ou **Bases: Add view**. A primeira da lista carrega por padrão, e a ordem se muda arrastando.
7. **Defina summaries** com o botão direito no cabeçalho da coluna → **Summarize…**, escolhendo entre as funções embutidas ou **Add summary** para uma formula própria sobre a lista `values`. Summaries pertencem à view, não à base — e quando os resultados estão agrupados, cada grupo ganha o seu no topo.
8. **Exporte** pelo menu *results*: limitar o número de linhas, **Copy to clipboard** (colável em planilha) ou **Export CSV**.

## Regras

- **Sem filtros, a base é o vault inteiro.** *"By default a base includes every file in the vault. There is no `from` or `source` like in SQL or Dataview."* O recorte é sempre subtrativo.
- **Filtro global e filtro de view concatenam com `AND`.** As duas seções são funcionalmente equivalentes; a da view nunca relaxa a global.
- **Formulas não podem ser circulares.** Uma formula pode usar outra via `formula.nome`, direta ou indiretamente, desde que não volte a si mesma.
- **`displayName` é só rótulo.** Display names não são usáveis em filtros nem em formulas — lá vale sempre o nome real da property.
- **Evite `file.backlinks`.** A doc marca a property como *performance heavy* e diz que ela não atualiza os resultados automaticamente quando o vault muda; a recomendação é inverter a consulta e usar `file.links`.
- **`this` muda de significado conforme o lugar.** Na área principal, aponta para o próprio arquivo da base; embutida em outra nota, para o arquivo que a embute; na sidebar, para o arquivo ativo — o que permite `file.hasLink(this.file)` replicar o painel de backlinks.
- **Agrupamento é por uma property só.** Ordenação aceita várias; grouping, não.
- **Wikilinks em properties viram Link objects** automaticamente e renderizam clicáveis na view; comparam-se com `==` e `!=` quando resolvem para o mesmo arquivo.

## Exemplo

Uma base escrita à mão para a manutenção do vault: todas as notas permanentes, com a idade em dias calculada, separadas em duas views — as evergreen e as que precisam de revisão.

```yaml
filters:
  and:
    - file.inFolder("02 Permanent Notes")
    - 'type != ""'
formulas:
  idade_dias: '((now() - file.ctime) / 86400000).round()'
  rotulo: 'type.title() + " · " + status'
properties:
  formula.idade_dias:
    displayName: "Idade (dias)"
  file.name:
    displayName: Nota
views:
  - type: table
    name: "Evergreen"
    filters:
      and:
        - 'status == "evergreen"'
    order:
      - file.name
      - type
      - formula.idade_dias
    summaries:
      formula.idade_dias: Median
  - type: table
    name: "A revisar"
    limit: 25
    groupBy:
      property: note.type
      direction: ASC
    filters:
      or:
        - 'status != "evergreen"'
        - "file.mtime < now() - '180d'"
    order:
      - file.name
      - formula.rotulo
```

A view "A revisar" mostra por que a base vale mais que uma busca salva: o critério `file.mtime < now() - '180d'` é temporal e relativo — recalculado a cada abertura, sem nada escrito nas notas.

---
Ref: [[Base (Obsidian Bases)]], [[Properties (Frontmatter)]], [[Escrever Frontmatter Consultável]], [[Busca Avançada no Obsidian]], [[Backlink]], [[Embed (Transclusão)]]
