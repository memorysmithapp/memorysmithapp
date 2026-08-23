---
title: Lixeira e purga (trash bin)
aliases: [Trash bin, Lixeira, Purga, Purge, Restauração, Restoration]
tags: [trash-bin, deletion, lifecycle]
type: concept
status: confirmed
source:
  - "[[EV-2-a2-001 · Ações sobre objetos e ações em massa|EV-2-a2-001]]"
  - "[[EV-2-a2-005 · Glossário oficial do GLPI|EV-2-a2-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Lixeira e purga (trash bin)

A **lixeira** (trash bin) é um estado intermediário antes da exclusão definitiva de elementos deletados por usuários, semelhante à lixeira de um ambiente desktop. Nem todo objeto tem lixeira associada.

Ao excluir um objeto (unitariamente ou por [[Ações em massa (massive actions)]]), há duas possibilidades:

- **Mover para a lixeira** (*Move to trash bin*): disponível se o objeto tem lixeira associada; o objeto pode ser **restaurado** depois (Restoration = recuperação de um elemento da lixeira).
- **Excluir permanentemente** (*Delete permanently*): quando não há lixeira; o GLPI pede confirmação antes da exclusão real no banco de dados.

> [!note] Purga
> **Purga** (Purge) é a exclusão permanente dos elementos que estão na lixeira. É a etapa final do ciclo: deletar → lixeira → restaurar (opcional) ou purgar.

Termos do glossário oficial cobertos aqui: *Trash bin*, *Purge*, *Restoration* (ver [[Glossário oficial (doc)]]). Relaciona-se ao [[Ciclo de vida de um item (add-update-delete)]] descrito no código.
