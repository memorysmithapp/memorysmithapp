---
title: Criar e Organizar um Vault
aliases:
  - Create a Vault
  - Organizar Vault
  - Setup de Vault
tags:
  - obsidian
  - pkm
  - vault
  - setup
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Criar um vault é escolher uma pasta do sistema de arquivos e declarar que ela é o universo de uma base de conhecimento — porque os internal links são locais ao vault, essa fronteira define o que pode ser ligado a quê. A prática cobre a decisão inicial (pasta nova ou pasta existente), o local no disco, as quatro configurações que determinam onde cada arquivo novo cai, e o primeiro backup — a única dessas etapas que é irreversível se pulada.

## Dinâmica / Passo a Passo

1. **Escolha entre vault vazio e pasta existente.** No vault switcher: ao lado de **Create new vault** → **Create** (informe **Vault name** e use **Browse** para escolher onde ele será criado); ou, para adotar uma pasta que já existe, ao lado de **Open folder as vault** → **Open** e selecione a pasta.
2. **Decida o local no disco antes de criar.** Se você pretende usar Obsidian Sync, mantenha o vault fora de pastas sincronizadas por outros serviços. Nunca crie o vault na system folder (`%APPDATA%\Obsidian\` no Windows, `/Users/você/Library/Application Support/obsidian` no macOS, `$XDG_CONFIG_HOME/obsidian/` ou `~/.config/obsidian/` no Linux) — a doc alerta para corrupção e perda de dados. E não aninhe vaults.
3. **Defina `Default location for new notes`** em **Settings → Files and links**: `Vault folder`, `Same folder as current file` ou `In the folder specified below`. A configuração não se aplica quando o link já traz o caminho — `[[Projects/Three laws of motion]]` cria a nota em `Projects` independentemente dela.
4. **Defina `Default location for new attachments`**, que tem uma opção a mais: `Vault folder`, `In the folder specified below`, `Same folder as current file` e `In subfolder under current folder`.
5. **Escolha o destino dos arquivos deletados**, também em **Settings → Files & Links**: **System trash** (padrão, recuperável pelo gerenciador de arquivos), **Obsidian trash** (uma pasta `.trash` dentro do vault) ou **Permanently delete** (sem qualquer forma de restauração).
6. **Transfira configurações copiando o `.obsidian`** da raiz do vault de origem para a raiz do vault de destino, com o gerenciador de arquivos ou o terminal. Pode ser preciso reiniciar o Obsidian.
7. **Administre o vault pelo vault switcher** (**Vault profile** no rodapé da sidebar esquerda → **Manage Vaults...**): renomear (renomeia também a pasta, já que os nomes são o mesmo), mover para outra pasta — feche a janela do vault e deixe a de Manage Vaults aberta — e **Remove from list**, que remove apenas da lista, não do disco.
8. **Faça o primeiro backup one-way** com uma ferramenta dedicada, para um local diferente, escolhendo **um** dispositivo como primário.

## Regras

- **Sync não é backup.** *"Syncing keeps your notes updated, but it doesn't protect against data loss."* Sync mantém arquivos iguais em todos os dispositivos; backup guarda uma cópia unidirecional em outro lugar. Ver [[Backup]], [[Snapshot]] e [[Disaster Recovery]].
- **Disponibilidade offline é obrigatória.** Se OneDrive (**Files On-Demand**) ou iCloud (**Optimize Mac Storage**) descarregam arquivos, o Obsidian não os acessa e passa a tratá-los como ausentes. Marque a pasta como **Always keep on this device** / **Keep Downloaded**.
- **Um vault, um serviço de sync.** Sincronizar o mesmo vault por dois serviços ao mesmo tempo — Obsidian Sync e iCloud, por exemplo — convida a conflito e corrupção.
- **Nomes de arquivo herdam as limitações do sistema operacional** onde a nota foi criada. Se o vault vai circular entre plataformas, use nomes seguros em todas elas.
- **Vault dentro de vault quebra links.** A recomendação é explícita: links podem não ser atualizados corretamente.
- **`.obsidian` não é opcional na cópia.** É ele que carrega hotkeys, temas e community plugins; a pasta fica oculta por padrão em quase todo sistema. Ver [[Configuration Folder]].

## Exemplo

Um vault de estudo em `~/Documents/Knowledge-Vault`, fora de qualquer pasta de nuvem, com `Default location for new notes` = `In the folder specified below` → `00 Inbox` e `Default location for new attachments` = `In the folder specified below` → `99 Attachments`. Deleção vai para **Obsidian trash**, de modo que o `.trash` viaja junto no backup. O backup é um `rsync` diário do desktop principal para um disco externo — cópia unidirecional, sem serviço de sync no caminho.

---
Ref: [[Vault]], [[Configuration Folder]], [[Attachment]], [[Local-first]], [[Backup]], [[File Recovery]], [[Configurar Sync com Sincronização Seletiva]]
