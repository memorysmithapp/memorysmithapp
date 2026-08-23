---
title: Migrar uma Base de Conhecimento para o Obsidian
aliases:
  - Migração para o Obsidian
  - Importar Notas
  - Knowledge Base Migration
tags:
  - obsidian
  - migration
  - pkm
  - local-first
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Migrar não é copiar arquivos: é escolher, no app de origem, o formato de exportação que perde menos, importar de uma vez só para que os links internos possam ser reconciliados, e normalizar a sintaxe depois. A ordem importa — o Format converter roda sobre o vault inteiro e presume que o conteúdo já chegou. E toda migração é lossy; a pergunta útil não é "vou perder algo?", mas "o que exatamente vou perder, e isso está documentado?".

## Dinâmica / Passo a Passo

1. **Escolha entre API import e file import** quando a origem oferecer os dois. No Notion, o **API import** preserva o workspace inteiro, incluindo Databases e formulas, que viram Bases — mas exige um integration token e conexão; o **file import** não preserva Databases e não exige token nem internet.
2. **Exporte no formato mais aberto que a origem oferecer.** Notion: **HTML**, com **Include everything** e **Create folders for subpages** — *não* Markdown. Roam Research: **Export All** com formato **JSON**. Evernote: **Export Notebook...** → **ENEX**. Textbundle quando o app suportar (Agenda, Craft, Taio, Ulysses, Zettlr e outros), porque o formato empacota o Markdown e todas as imagens referenciadas num arquivo só.
3. **Instale e habilite o Importer**, community plugin oficial da equipe do Obsidian: **Settings → Community Plugins**, instalar, habilitar, e abrir pelo comando ou pelo ícone da ribbon.
4. **Escolha o File format e importe tudo de uma vez.** A doc é explícita no caso do Notion: *"It's recommended to import all your Notion at once so internal links can be reconciled correctly."* Importar em lotes quebra as ligações entre lotes.
5. **Rode o Format converter depois**, não antes: **Command palette → Open format converter** (ou o ícone na ribbon), marque os formatos e **Start conversion**. Ele converte a sintaxe de Roam (`#tag` e `#[[tag]]` → `[[tag]]`, `^^highlight^^` → `==highlight==`, `{{[[TODO]]}}` → `[ ]`), de Bear (`::highlight::` → `==highlight==`), de Zettelkasten (`[[UID]]` → `[[UID File Name]]`, ou `[[UID File Name|File Name]]` no modo *pretty links*) e as properties depreciadas `alias`, `tag` e `cssclass` para `aliases`, `tags` e `cssclasses`.
6. **Reconstrua manualmente o que não veio.** A hierarquia de tags do Evernote não sobrevive à exportação: recrie renomeando `ChildTag` para `ParentTag/ChildTag`. Os stacks também não vêm, porque a exportação é por notebook — mas o importer reconhece o padrão no nome do arquivo: renomear o `.enex` para `Stack1@@@NotebookA` gera as notas em `Stack1/NotebookA`.
7. **Confira o resultado** pelos mesmos instrumentos de sempre: links não resolvidos, órfãs, e a lista de properties do vault depois da conversão.

## Regras

- **Backup antes do Format converter.** *"Format converter converts your entire vault based on your settings."* Não há seleção de escopo e não há desfazer.
- **Toda migração é lossy, e a doc lista as perdas por origem.** No API import do Notion: só a primary view de cada database é importada, linked data sources não vêm, e as funções `name()`, `email()`, `style()` e `unstyle()` não convertem. No Apple Notes, notas protegidas por senha são criptografadas pela Apple e **puladas** — precisam ser destravadas antes.
- **O Markdown export do Notion "omits important data".** É contraintuitivo — o formato aparentemente mais próximo do destino é o pior caminho —, e é a recomendação literal da doc: use HTML.
- **Estrutura de origem sem equivalente vira aproximação.** No Notion é possível escrever conteúdo dentro de pastas; no Obsidian, não — essas páginas viram subpáginas sob a pasta.
- **A assimetria é a lição da prática:** formatos fechados perdem **estrutura** (databases, views, hierarquia de tags, notas travadas), formatos abertos perdem no máximo **sintaxe** — e sintaxe é exatamente o que o Format converter resolve em um clique. É a razão prática pela qual o plain text local vale mais que a conveniência do app fechado. Ver [[Vendor Lock-in]] e [[Data Portability]].
- **Importar em partes só quando a ferramenta obriga.** Exportações do Notion com vários gigabytes podem conter `.zip` aninhados; nesse caso descompacte e importe os `Export-{id}-Part-1.zip` individualmente.
- **Se o Obsidian parecer travar durante a importação**, desabilite os community plugins e tente de novo.

## Exemplo

Migração de um workspace do Notion com um banco de dados de leituras e algumas centenas de páginas soltas, mais um arquivo antigo do Evernote em ENEX, mais notas Zettelkasten legadas com links por UID.

| Origem | Formato exportado | O que o Importer preserva | O que fica para o passo manual |
|---|---|---|---|
| Notion (API) | — | Páginas, Databases → `.base`, formulas | Views secundárias, linked data sources |
| Notion (arquivo) | HTML | Páginas e estrutura de subpáginas | Databases |
| Evernote | ENEX | Notas e attachments | Hierarquia de tags, stacks |
| Zettelkasten | Markdown | Arquivos como estão | Links `[[UID]]` \| Format converter |

Sequência executada: API import do Notion inteiro numa passada; renomear os `.enex` para `Stack1@@@NotebookA` antes de importar; **backup do vault**; e só então o Format converter com **Zettelkasten link fixer** e a conversão de properties depreciadas ligados. Depois disso, `obsidian unresolved` mostra o que a migração deixou pendurado.

---
Ref: [[Data Portability]], [[Vendor Lock-in]], [[Obsidian Plugin]], [[Properties (Frontmatter)]], [[Tag (Obsidian)]], [[Unique Note (Zettelkasten Prefix)]], [[Base (Obsidian Bases)]], [[Criar e Organizar um Vault]]
