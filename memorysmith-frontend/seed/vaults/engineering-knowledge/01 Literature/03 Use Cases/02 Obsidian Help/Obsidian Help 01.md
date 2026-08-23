---
title: Obsidian Help 01
aliases:
  - Obsidian Help — Fundamentos, Vault e Arquivos
tags:
  - obsidian
  - pkm
  - literature
  - local-first
  - note-taking
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 01 — Fundamentos, Vault e Arquivos

*About Obsidian · Create a vault · Create your first note · Download and install Obsidian · Glossary · Mobile app · Sandbox vault · Back up your Obsidian files · Update Obsidian · Sync your notes across devices · Link notes · Accepted file formats · Configuration folder · How Obsidian stores data · Manage notes · Manage vaults · Symbolic links and junctions · Obsidian for Android · Licenses and payment · Help and support*

## Resumo executivo

Este eixo define o que o Obsidian **é** antes de qualquer funcionalidade: *"both a Markdown editor and a knowledge base app"* sobre uma pasta do sistema de arquivos. Sync, recuperação e licenciamento são consequências dessa escolha — e a doc é explícita sobre as fronteiras que ela exige.

## Principais ideias

### O vault é uma pasta, e isso é arquitetura, não conveniência

*"A vault is a folder on your local file system, including any subfolders."* Não há importação nem banco proprietário — uma das duas opções do primeiro launch é **Open folder as vault**. O acoplamento é literal — o nome do vault *é* o nome da pasta, e transferir configuração é copiar `.obsidian` de uma raiz para outra. Daí decorre que *"you can use other text editors and file managers to edit and manage notes"*, com refresh automático, e que nomes de arquivo herdam limites do SO. Formatos reconhecidos são conjunto fechado — `.md`, `.base`, `.canvas`, imagens, áudio, vídeo, `.pdf` — e o resto exige [[Obsidian Plugin]] de comunidade. Ver [[Vault]] e [[Local-first]].

### O armazenamento tem três camadas de durabilidade

**(1)** O vault e o `.obsidian` na raiz, com hotkeys, themes e plugins daquele vault; o nome se troca em **Settings → Files and Links → Override config folder** por outro iniciado com ponto, exige relaunch, e as configurações antigas **não** migram para o novo perfil. **(2)** Global settings numa system folder **fora** do vault (`%APPDATA%\Obsidian\`, `~/Library/Application Support/obsidian`, `$XDG_CONFIG_HOME/obsidian/`), onde ficam os snapshots do [[File Recovery]] — *"to account for vault-related data loss"*, o que os amarra ao caminho absoluto e os mantém locais por dispositivo. **(3)** IndexedDB e o **metadata cache**: camada derivada, que sustenta Graph view e Outline, pode dessincronizar e é reconstruível em *Files and links*. Ver [[Configuration Folder]] e [[Metadata Cache]].

### "Syncing is not a backup", e há quatro famílias de sync

A distinção é definicional: sync mantém arquivos idênticos em todos os dispositivos e **não reconhece nenhum como primário**; backup é cópia unidirecional, sem tempo real. Sem primário, elege-se um dispositivo de backup por convenção. Quatro famílias: first-party (Obsidian Sync), cloud de terceiros (iCloud, OneDrive, Google Drive), local (Syncthing) e version control (Git, Working Copy, com push/pull manuais). O modo de falha é sempre offloading — OneDrive exige **Always keep on this device**, iCloud **Keep Downloaded** — porque *"Obsidian requires access to the entire vault for its features (e.g., updating links when renaming a file)"*. Misturar dois serviços no mesmo vault é anti-padrão. Ver [[Backup]] e [[Disaster Recovery]].

### As fronteiras que o vault precisa manter fechadas

Vault dentro de vault é desaconselhado porque *"internal links are local to a vault"*; vault na system folder corrompe dados. Symlinks levam `[!danger]`: alvos devem ser **fully disjoint** da raiz e entre si, loops são bloqueados, e symlinkar sob `.obsidian/` *"has a high chance of corrupting your settings"*. Todas protegem o endereçamento por nome, que caminho ambíguo ou arquivo duplicado quebra. No Android isso vira escolha explícita — **device storage** (recomendada, pede permissão "All files", compatível com Syncthing) contra **app storage** (isolada, e desinstalar apaga o vault local).

### O modelo econômico não é a chave de acesso

O app é gratuito e o que se compra fica ao lado dele. Catalyst é compra única em três tiers — $25 Insider, $50 Supporter, $100 VIP — dando early access e badges; Commercial cobre o uso no trabalho. Ambas são irreembolsáveis — *"they are intended to support Obsidian development and are not services"* — enquanto Sync e Publish, serviços, têm 7 dias de reembolso e 40% de desconto educacional. Cancelar destrói remote vault e site, mas *"your local data on your devices will remain unaffected"*. Ver [[Vendor Lock-in]].

## Conceitos apresentados

- [[Vault]] — a pasta como unidade de escopo e de endereçamento
- [[Local-first]] — plain text no disco como premissa, não como exportação
- [[Configuration Folder]] — `.obsidian` e a troca de perfil
- [[Metadata Cache]] — a camada derivada
- [[File Recovery]] — snapshots a cada 5 min, 7 dias, só `.md` e `.canvas`
- [[Criar e Organizar um Vault]] — a prática destilada daqui

## Exemplos

> [!quote] About Obsidian — por que plain text
> *"We believe in plain text for something as important as your knowledge base. You don't want to put your own brain over someone else's neck, do you?"*

> [!quote] Back up your Obsidian files — a inevitabilidade
> *"It is never a matter of if, but when."*

---
Ref: [[Obsidian Help]], [[Vault]], [[Local-first]], [[Criar e Organizar um Vault]], [[Backup]]
