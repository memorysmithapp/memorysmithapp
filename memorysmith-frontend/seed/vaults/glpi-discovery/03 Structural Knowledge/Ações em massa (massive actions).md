---
title: Ações em massa (massive actions)
aliases: [Massive actions, Mass actions, Ações em lote, Botão Actions]
tags: [massive-actions, ui, crud, bulk]
type: component
status: confirmed
source: "[[EV-2-a2-001 · Ações sobre objetos e ações em massa|EV-2-a2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Ações em massa (massive actions)

Recurso transversal da interface que aplica uma mesma operação a vários itens selecionados de uma lista, evitando repetir a operação item a item. É acionado marcando os checkboxes à esquerda dos nomes dos objetos e clicando no botão **Actions**.

> [!note] Padrão de uso
> Fluxo típico: selecionar checkboxes → botão **Actions** → escolher a ação → informar parâmetros → confirmar (ex.: botão **Post** na modificação em massa). Aplica-se a modificar campos, excluir, anexar documento (**Add a Document**), anexar contrato (**Add a Contract**), alterar status, adicionar à lista de transferência, entre outros.

As ações disponíveis dependem das permissões do [[Perfis e Direitos (RBAC)|perfil]] do usuário — algumas ações da aba dependem de permissão de perfil, inclusive as próprias mass actions. As ações aparecem sobre listas produzidas pelo [[Motor de Busca (Search Engine)]].

Conceito relacionado no glossário oficial: *Actions* — "grouping in a list of available handling of GLPI objects" (ver [[Glossário oficial (doc)]]).

Ver o passo a passo de cada operação em [[Operações de interface sobre itens (criar, modificar, exibir, excluir)]].

> [!note] Ver também
> Fluxo de uso em [[Ações Massivas (bulk actions)]].
