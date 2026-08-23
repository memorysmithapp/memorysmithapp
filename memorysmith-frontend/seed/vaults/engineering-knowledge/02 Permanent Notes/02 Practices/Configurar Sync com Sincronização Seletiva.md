---
title: Configurar Sync com Sincronização Seletiva
aliases:
  - Selective Sync
  - Configurar Obsidian Sync
  - Sincronização Seletiva
tags:
  - obsidian
  - sync
  - encryption
  - local-first
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Configurar o Obsidian Sync tem uma ordem correta, e ela existe por um motivo assimétrico: quase tudo é reversível, menos o que já subiu para o remote vault. Excluir uma pasta depois do primeiro sync não a remove de lá. A prática, portanto, é uma sequência em que todos os ajustes de escopo — selective sync, vault configuration sync, excluded folders — acontecem **antes** de apertar Start Syncing.

## Dinâmica / Passo a Passo

1. **Faça o backup antes de qualquer coisa.** A própria doc lista o backup como pré-requisito recomendado e repete que um serviço de sync não é backup.
2. **Tire o vault de dentro de pastas de serviços de nuvem.** Se o vault estiver em iCloud, OneDrive, Dropbox ou similar, a seção Remote vault das Sync settings exibe uma mensagem de erro em vermelho; a solução é mover o vault antes de prosseguir.
3. **Faça login:** **Settings → General → Account → Your Account → Log in**, com e-mail e senha.
4. **Ative o core plugin:** **Settings → Core Plugins → Sync**.
5. **Crie o remote vault:** **Settings → Sync**, ao lado de **Remote vault** clique em **Choose** → **Create new vault**; informe **Vault name**, escolha a **Region** e defina uma **Encryption password**, que cria um vault com end-to-end encryption. Essa senha é separada da conta Obsidian e pode ser diferente para cada vault.
6. **Conecte-se** clicando em **Connect** ao lado do vault recém-criado e informando a encryption password em **Unlock vault** — e **não comece a sincronizar ainda**. Feche o pop-up que oferece **Exclude Folders** e **Start Syncing**.
7. **Defina o Device name** (facilita a leitura do sync log) e a **Conflict resolution**: **Automatically merge**, o padrão, que combina as mudanças num arquivo só, ou **Create conflict file**, que gera um arquivo separado no padrão `original-note-name (Conflicted copy device-name YYYYMMDDHHMM).md` para revisão manual.
8. **Ajuste o Selective sync e o Vault configuration sync.** Por padrão o selective sync já cobre imagens, áudio, vídeos e PDFs; `Sync all other types` amplia. O vault configuration sync já traz por padrão other file types, main settings, appearance, themes and snippets, hotkeys, active core plugin list e core plugin settings — **Active community plugin list** e **Installed community plugin list** precisam ser ligados à mão.
9. **Configure os Excluded folders antes do primeiro sync:** **Settings → Sync → Excluded folders → Manage**, selecione as pastas e **Done**.
10. **Reinicie o Obsidian completamente** (no mobile ou tablet pode ser preciso um force-quit) e só então volte a **Settings → Sync** e clique em **Start Syncing** ou **Resume**. O sinal de conclusão é o círculo verde com checkmark e a mensagem "Fully Synced" no log.
11. **Só agora conecte o dispositivo secundário.** Na instalação nova, pelo vault switcher: **Setup** em "Open vault from Obsidian Sync" no desktop, **Setup Obsidian Sync** no mobile; login (com o código de 2FA, se houver), **Connect** no remote vault desejado, nome do vault local — use o **mesmo nome** dos outros dispositivos se você usa Obsidian URIs — e **Create**. Feche a janela *Setup Connection* e ajuste as Sync settings deste dispositivo antes de iniciar.

## Regras

- **As Sync settings não sincronizam.** *"Sync settings do not sync across devices."* Device name, conflict resolution e selective sync são configurados dispositivo por dispositivo.
- **Excluir depois não remove o que já subiu.** Adicionar um arquivo à lista de Excluded files não o retira do remote vault se ele já foi sincronizado — e ele continua consumindo o limite de armazenamento.
- **Snapshots do File recovery e arquivos iniciando por `.` nunca sincronizam.** Os snapshots ficam nas global settings, fora do vault; `.vscode`, `.git`, `.idea` e `.gitignore` são tratados como ocultos. A única exceção é a configuration folder `.obsidian`.
- **O uso de armazenamento demora a atualizar.** Até 30 minutos, por processamento no servidor — não conclua nada a partir da barra de progresso logo depois de um sync grande.
- **Um vault, um método de sync.** Nunca combine Obsidian Sync com iCloud, Dropbox ou OneDrive no mesmo vault.
- **Um dispositivo, um cliente de sync.** *"Do not use both the desktop app Sync and Headless Sync on the same device, as it can cause data conflicts."*
- **A região é praticamente definitiva.** Depois de escolhida, o data center não pode ser trocado sem reenviar os dados.
- **O tamanho máximo de arquivo depende do plano:** 5 MB no Standard, 200 MB no Plus. A retenção do version history também: 1 mês no Standard, 12 meses no Plus, e duas semanas para versões antigas de attachments.

## Exemplo

Um vault com uma pasta `99 Attachments` pesada e uma pasta `zz Scratch` que não interessa a ninguém. A ordem que evita desperdício: criar o remote vault, conectar, **fechar o pop-up**, marcar `zz Scratch` em Excluded folders, deixar `Sync all other types` desligado, reiniciar o app e só então **Start Syncing**. Feito na ordem inversa — sincronizar primeiro e excluir depois —, o `zz Scratch` permaneceria no remote vault ocupando cota, e nenhuma configuração local o apagaria de lá.

Para perfis diferentes por dispositivo, o Sync consegue manter várias configuration folders no mesmo remote vault: em **Settings → Files and links → Override config folder**, um nome começando com ponto, como `.obsidian-mobile`. Copiar o `.obsidian` existente e renomeá-lo antes evita rebaixar plugins e temas.

---
Ref: [[Obsidian Sync]], [[Remote Vault]], [[End-to-End Encryption]], [[Version History]], [[Configuration Folder]], [[File Recovery]], [[Criar e Organizar um Vault]], [[Automatizar o Obsidian por URI e CLI]]
