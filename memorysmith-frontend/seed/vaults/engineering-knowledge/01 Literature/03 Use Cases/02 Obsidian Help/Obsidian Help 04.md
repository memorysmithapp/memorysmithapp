---
title: Obsidian Help 04
aliases:
  - Obsidian Help — Plugins Core e Bases
tags:
  - obsidian
  - pkm
  - literature
  - plugin
  - database
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 04 — Plugins Core e Bases

*Core plugins · Canvas · Daily notes · Templates · Unique note creator · Note composer · Command palette · Slash commands · File explorer · File recovery · Properties view · Slides · Audio recorder · Web viewer · Word count · Workspaces · Format converter · Bookmarks · Bases: Introduction, Create a base, Views, syntax, Formulas, Functions e os layouts Table, Cards, List, Map*

## Resumo executivo

O core plugin é a unidade de composição do Obsidian: núcleo mínimo — ver, editar e buscar arquivos — mais blocos que se ligam e desligam em *Settings → Core plugins*. Bases é o mais consequente, por virar o frontmatter existente em dataset consultável sem armazenamento novo; Canvas é o oposto, guardando o que ainda não tem esquema.

## Principais ideias

### Núcleo mínimo mais building blocks: o ganho no que não aparece

*"The foundation is to be able to view files, edit them, and search them. For the minimalist, that's enough."* Acima disso vêm blocos isolados, escolhidos por perfil: Audio recorder e LaTeX para aula, Slides e Backlinks para trabalho, Graph view e Word count para pesquisa. A justificativa é negativa — *"without all the features that you don't need cluttering the interface"*. Parte deles vem desativada, e há plugins oficiais **fora** do core (Importer, Maps). Ver [[Obsidian Plugin]].

| Plugin | O que faz | Detalhe factual |
| --- | --- | --- |
| Bases | Views de banco sobre properties | Sem `from`/`source`; `.base` ou code block |
| Canvas | Espaço 2D com cards e arestas | Grava `.canvas`, no formato aberto JSON Canvas |
| Daily notes | Abre ou cria a nota do dia | Default `YYYY-MM-DD`; date format cria subpasta |
| Templates | Insere conteúdo pré-definido | `{{title}}`, `{{date}}`, `{{time}}`, tokens Moment.js |
| Unique note creator | Título time-coded | 01/01/2024 às 09:45 vira `202401010945` |
| Note composer | Merge e extract | Atualiza os links; template com `{{content}}` |
| File recovery | Snapshots automáticos | 5 min de intervalo, 7 dias, só `.md` e `.canvas` |
| Command palette | Comandos pelo teclado | `Ctrl/Cmd+P`; "scf" acha *Save current file* |
| Format converter | Converte Markdown alheio | Roam, Bear, Zettelkasten, properties antigas |

### Bases é camada de consulta pura sobre o frontmatter

*"All the data in Obsidian Bases is stored in your local Markdown files and their properties."* A base não guarda dado: guarda a **descrição de views**, em YAML, num `.base` ou em code block. O universo é o vault inteiro e `filters` só subtrai; filtros globais e de view se concatenam com `AND`. Três famílias de property: **note** (`price`), **file** (`file.name`, `file.ext`, `file.folder`, `file.mtime`, `file.tags`, `file.links`) e **formula** (`formula.ppu`) — com `file.backlinks` marcado *"performance heavy"*. Table e Cards existem desde a 1.9; List e Map, na 1.10. Ver [[Base (Obsidian Bases)]] e [[Modelar uma Base sobre o Frontmatter]].

### O objeto `this` revela o modelo da base

Aberta na área principal, `this` aponta para o próprio `.base`: `this.file.folder` devolve a pasta dele. Embutida em outro arquivo, aponta para o **hospedeiro** — `this.file.name` é o nome da nota que contém o embed. Na sidebar, aponta para o arquivo ativo no centro, o que permite `file.hasLink(this.file)` para *"replicate the backlinks pane"*. A consulta é parametrizada pelo contexto: o mesmo YAML serve como índice global, seção de nota ou painel contextual.

### Canvas é o complemento não-declarativo, e cobra preço no grafo

Onde Bases exige a informação em property, Canvas aceita o que ainda não tem campo: posição, agrupamento e **arestas rotuladas**. A linha entre dois cards é direcionada, colorível e nomeável por duplo clique — a relação vira dado sem nome de property. Cards vêm de notas, mídia, pastas inteiras ou páginas web. O custo: text cards só entram em Backlinks depois de **Convert to file...**, e canvas embutido mostra as formas, não o texto dos cards. Ver [[Canvas]].

### Unique note creator é Zettelkasten literal, e atrita com o link por nome

O plugin nomeia a nota com o timestamp da criação e, em colisão, usa o próximo disponível: identidade estável, independente do título. Mas o Obsidian endereça links **por nome de arquivo**, e `[[202401010945]]` nada comunica ao leitor; as saídas nativas são `aliases` e um template em **Template file location**. Não por acaso o Format converter tem seção Zettelkasten para essa costura, convertendo `[[UID]]` em `[[UID File Name]]`. Ver [[Unique Note (Zettelkasten Prefix)]].

### Templates é onde a nota nasce com o esquema que a Base consulta

O contato entre os dois eixos é temporal: uma base só encontra `status` ou `course` se a nota nasceu com esses campos. O exemplo da doc põe o frontmatter completo no template, e o comportamento é de merge — *"Obsidian will also merge any properties that exist in your note with properties in the template."* Daily notes e Unique note creator usam o mesmo mecanismo, o que faz do template o único ponto em que o esquema é imposto. No outro extremo, Note composer move texto entre notas com `Enter`, `Shift+Enter` e `Ctrl/Cmd+Enter` (fim, início, nova nota) atualizando os links — e um merge errado se desfaz pelo [[File Recovery]]. Ver [[Daily Note]] e [[Refatorar Notas com Note Composer]].

## Conceitos apresentados

- [[Obsidian Plugin]] — o bloco isolado como unidade de composição
- [[Canvas]] — 2D, arestas rotuladas e JSON Canvas
- [[Base (Obsidian Bases)]] — consulta sobre note, file e formula properties
- [[Daily Note]] — a nota do dia como ponto de captura
- [[Unique Note (Zettelkasten Prefix)]] — identidade por timestamp
- [[File Recovery]] — snapshots por dispositivo, fora do vault
- [[Modelar uma Base sobre o Frontmatter]] — esquema antes da consulta
- [[Refatorar Notas com Note Composer]] — merge e extract sem quebrar link

## Exemplos

> [!quote] Bases syntax — a ausência que define o modelo
> *"By default a base includes every file in the vault. There is no `from` or `source` like in SQL or Dataview."*

> [!quote] Canvas — o limite dos text cards
> *"Text-only cards don't appear in Backlinks. To make them appear, you need to convert them to a file."*

---
Ref: [[Obsidian Help]], [[Base (Obsidian Bases)]], [[Canvas]], [[Obsidian Plugin]], [[Modelar uma Base sobre o Frontmatter]]
