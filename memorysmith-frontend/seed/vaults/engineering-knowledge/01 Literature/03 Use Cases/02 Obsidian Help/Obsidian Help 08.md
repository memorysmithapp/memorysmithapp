---
title: Obsidian Help 08
aliases:
  - Obsidian Help — Migração, Importação e Portabilidade
tags:
  - obsidian
  - pkm
  - literature
  - migration
  - local-first
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 08 — Migração, Importação e Portabilidade

*Import notes, todas as páginas · Importer · Format converter*

## Resumo executivo

É o único eixo em que a doc trata **sair** como capacidade documentada, não como risco. Duas ferramentas cobrem escopos complementares — o Importer traduz o empacotamento, o Format converter traduz o dialeto — e cada página termina com lista explícita de perdas, que lida ao contrário é um argumento sobre formatos.

## Principais ideias

### "Apps come and go, but your data should last"

A abertura de *Import notes* é a premissa inteira: Markdown não proprietário, em texto puro, local, *"which means you can use Obsidian offline and switch to another app easily if you ever need to."* Cada importador converte para *"durable Markdown files, that you can use with Obsidian and many other apps"* — a promessa não é lealdade ao Obsidian, é durabilidade do arquivo. Ver [[Vendor Lock-in]].

### Duas ferramentas, dois escopos: empacotamento e dialeto

O **Importer** é community plugin oficial do time do Obsidian e resolve o *container*: desempacotar `.enex`, `.bear2bk`, `.zip` do Takeout, `.textbundle`, JSON do Roam, ou falar com uma API. O **Format converter** é core plugin e resolve o *dialeto*: converte para [[Obsidian Flavored Markdown (OFM)|OFM]] — `^^highlight^^` e `::highlight::` em `==highlight==`, `{{[[TODO]]}}` em `[ ]` — e migra properties depreciadas. Converte o **vault inteiro**, daí o aviso de [[Backup|backup]].

### API import versus file import é trade-off explícito

O Notion tem os dois caminhos: API import preserva o workspace inteiro, com databases e formulas em [[Base (Obsidian Bases)|Bases]], mas exige token (`ntn_...`) e conexão; file import não preserva databases, mas dispensa token e internet. O eixo é fidelidade estrutural contra independência de rede. Detalhe contraintuitivo: no file import a doc recomenda **HTML**, não Markdown, porque o export Markdown *"omits important data"*.

### A taxonomia das perdas tem cinco causas distintas

**(1) Limitação da API de origem**: rollups do Airtable não vêm porque a API não expõe a agregação; linked data sources do Notion não são suportadas. **(2) Ausência de equivalente**: formulas com `SWITCH` e `REGEX_EXTRACT` caem para o valor estático; views kanban e Gantt são ignoradas. **(3) Ausência do dado no export**: o Keep não exporta indentação, e checklists chegam no nível superior; o `.enex` não guarda hierarquia de tags. **(4) Criptografia**: notas com senha do Apple Notes são puladas. **(5) Incompatibilidade de modelo**: reminders e assignments não existem no Obsidian.

### Formatos fechados perdem estrutura; abertos perdem no máximo sintaxe

No extremo fechado, Apple Notes exige acesso à pasta `group.com.apple.notes` e só roda no macOS, e o Apple Journal importa metadados ricos — *state-of-mind*, *contacts*, *location*, *workout-route* — mas descarta todos os resources. No meio, o Textbundle atravessa a fronteira empacotando Markdown e imagens, *"providing a more seamless way to move out of a sandboxed application"*. No extremo aberto, importar Markdown é arrastar arquivos para o file explorer, e o resíduo é só sintaxe — o que o Format converter conserta.

| Origem | Export recomendado | Preserva | Perde |
| --- | --- | --- | --- |
| Notion (API) | token `ntn_...` | workspace, databases e formulas como Bases | só a primary view; linked data sources |
| Notion (arquivo) | HTML, *Include everything* | páginas, subpáginas, links reconciliados | databases |
| Airtable | token `pat...` | nota por record, `.base` por tabela, tipos, links | rollups; formulas sem equivalente; views kanban |
| Evernote | `.enex` por notebook | notas, conteúdo, tags | hierarquia de tags; notebook stacks |
| Apple Notes | leitura direta, macOS | tabelas, imagens, drawings, scans, PDFs | notas com senha; iOS |
| Google Keep | `.zip` do Takeout | conteúdo e tags | indentação de checklists; reminders |
| Roam Research | JSON | notas e, opcional, attachments | sintaxe própria |

### O caso Zettelkasten é o caso-limite

A regra que quebra a migração está no destino: o Obsidian resolve links pelo **nome completo do arquivo, não por UID**. Quem vinha de notas como `202301011230 My note title` com links só como `[[202301011230]]` chega com o grafo quebrado. A ponte é o Format converter — o *link fixer* faz `[[UID]]` virar `[[UID File Name]]`, e o *beautifier* produz `[[UID File Name|File Name]]`.

## Conceitos apresentados

- [[Data Portability]] — a saída como feature declarada
- [[Unique Note (Zettelkasten Prefix)]] — o UID no nome, resolução por nome
- [[Local-first]] — plain text não proprietário
- [[Migrar uma Base de Conhecimento para o Obsidian]] — a prática do eixo

## Exemplos

> [!quote] Import notes — a premissa
> *"Apps come and go, but your data should last. Obsidian uses non-proprietary plain text Markdown files stored locally on your device."*

> [!quote] Import from Notion — o formato mais próximo não é o mais fiel
> *"We recommend that you do not use Notion's Markdown export as it omits important data."*

---
Ref: [[Obsidian Help]], [[Data Portability]], [[Local-first]], [[Migrar uma Base de Conhecimento para o Obsidian]], [[Unique Note (Zettelkasten Prefix)]]
