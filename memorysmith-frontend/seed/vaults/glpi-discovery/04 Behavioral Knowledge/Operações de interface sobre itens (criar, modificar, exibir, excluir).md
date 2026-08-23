---
title: Operações de interface sobre itens (criar, modificar, exibir, excluir)
aliases: [CRUD de interface, Ações sobre objetos, Anexar documento, Anexar contrato]
tags: [crud, ui, procedure, actions]
type: use-case
status: confirmed
source: "[[EV-2-a2-001 · Ações sobre objetos e ações em massa|EV-2-a2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Operações de interface sobre itens (criar, modificar, exibir, excluir)

Procedimentos de interface comuns a diferentes tipos de objeto do GLPI. Todas as permissões dependem do [[Perfis e Direitos (RBAC)|perfil]] do usuário. É a perspectiva de uso do [[Ciclo de vida de um item (add-update-delete)]] descrito no código.

## Criação

Conectar → ir à página do objeto (ex.: `Assets > Computers`) → botão **"+"** no menu horizontal → se houver template, escolher o [[Templates de itens (modelos)|template]] → preencher os campos → validar. A preferência de usuário *After creation, go to created element* controla se, após criar, o objeto é exibido ou se um novo formulário vazio é aberto para criar outro.

## Modificação

- **Unitária**: clicar no nome do objeto → modificar campos → botão **Update**.
- **Em massa**: marcar checkbox → botão **Actions** → escolher o campo → informar valor → botão **Post** (ver [[Ações em massa (massive actions)]]).

## Exibição

Depende da permissão `read`. Sem ela, o nome do objeto não aparece nos menus (mesmo com permissão de modificação). Fluxo: ir à página do objeto ou buscá-lo → clicar no nome.

## Anexar documento / contrato

- **Documento**: unitário (aba **Documents** → **Choose**/**Add**) ou em massa (**Actions** → **Add a Document**). Ver [[Documentos (Document)]].
- **Contrato**: unitário (aba **Contracts** → **Add**) ou em massa (**Actions** → **Add a Contract**). Ver [[Contratos (Contract)]].

## Exclusão

Depende da permissão `delete`. Unitária (botão **Delete**) ou em massa (**Actions**). Escolha entre *Move to trash bin* (restaurável) e *Delete permanently* (com confirmação) — ver [[Lixeira e purga (trash bin)]].
