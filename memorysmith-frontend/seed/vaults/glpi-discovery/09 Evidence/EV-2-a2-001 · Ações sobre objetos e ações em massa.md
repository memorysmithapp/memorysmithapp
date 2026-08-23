---
title: EV-2-a2-001 · Ações sobre objetos e ações em massa
aliases: [EV-2-a2-001]
tags: [evidence, actions, massive-actions, crud, transfer, trash-bin]
type: evidence
status: confirmed
source: "SRC-002 · modules/overview/actions.rst · modules/overview/index.rst · Actions (Creation, Modification, Display, Attaching a document, Attaching a contract, Transfer between entities, Deletion)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a2-001 · Ações sobre objetos e ações em massa

> [!quote] Ações disponíveis dependem do perfil
> "The different actions that are available on an object depend on the permissions assigned in user profile. Likewise, some actions in the tab depend on profile permission, such as mass actions." — `actions.rst`, introdução.

O documento descreve as ações principais aplicáveis a diferentes tipos de objetos (não específicas de um objeto):

> [!quote] Criação
> Para todos os objetos de inventário: conectar; ir à página do objeto (ex.: `Assets > Computers`); clicar no botão "+" do menu horizontal; se o objeto tiver template, escolher o template; preencher os campos; validar. A preferência de usuário *After creation, go to created element* controla se, após criar, o objeto é exibido ou se um novo formulário vazio é aberto. — `actions.rst`, "Creation".

> [!quote] Modificação — unitária vs em massa
> Modificação unitária: clicar no nome do objeto → modificar campos → botão **Update**. Modificação em massa: marcar o checkbox à esquerda do nome → botão **Actions** → escolher o campo a modificar → informar novo valor → botão **Post**. — `actions.rst`, "Modification".

> [!quote] Exibição depende de permissão `read`
> "If the permission to display an object is not granted, the name of this object will not appear in GLPI different menus." Ex.: sem permissão de leitura de `Computer`, o submenu `Computer` não aparece em `Assets`, mesmo com permissão de modificação. — `actions.rst`, "Display".

> [!quote] Anexos por ação em massa
> Anexar documento: unitário (aba **Documents** → **Choose**/**Add**) ou em massa (checkbox → **Actions** → **Add a Document**). Anexar contrato: unitário (aba **Contracts** → **Add**) ou em massa (checkbox → **Actions** → **Add a Contract**). — `actions.rst`, "Attaching a document" / "Attaching a contract".

> [!quote] Transferência entre entidades
> As entidades permitem definir perfis de transferência para mover elementos entre entidades (ex.: migrar de uma entidade única para múltiplas entidades). É preciso permissão de leitura de **Transfer** (`Administration > Profiles`). Passos: configurar as ações do transfer via regra de transferência; garantir permissão na entidade de origem e destino (perfil recursivo da entidade raiz); ir à entidade raiz (`See all`); selecionar o elemento; **Add to transfer list** → **Validate**; escolher o **Transfer mode** (perfil de configuração); selecionar entidade destino; **Transfer**. Um elemento vinculado inexistente no destino é criado se o perfil de transferência pedir para mantê-lo. Aviso: localização e grupo devem ser atualizados para a entidade destino. — `actions.rst`, "Transfer between entities".

> [!quote] Exclusão — lixeira vs exclusão permanente
> Exclusão unitária (botão **Delete**) ou em massa (checkbox → **Actions**). Em ambos os casos há escolha entre *Move to trash bin* (se o objeto tem lixeira associada, podendo ser restaurado depois) e *Delete permanently* (sem lixeira; GLPI pede confirmação antes da exclusão real no banco). — `actions.rst`, "Deletion".

> [!note] Ponto de dúvida do próprio doc
> O texto contém um comentário `.. ??? must check: correct name of the permission` sobre o nome exato da permissão de transferência. Registrado em [[INV-2-a2-001 · Nome da permissão de transferência entre entidades]].

## Sustenta
- [[Ações em massa (massive actions)]]
- [[Operações de interface sobre itens (criar, modificar, exibir, excluir)]]
- [[Lixeira e purga (trash bin)]]
- [[Transferência de itens entre entidades (processo)]]
