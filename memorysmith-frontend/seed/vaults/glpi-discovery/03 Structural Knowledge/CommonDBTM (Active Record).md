---
title: CommonDBTM (Active Record)
aliases: [CommonDBTM, Active Record base]
tags: [component, orm, dominio/foundation]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-1-001 · CommonDBTM é o active-record base com ciclo add-update-delete|EV-1-001]]"
author: CAD Discovery
created: 2026-07-10
---

# CommonDBTM (Active Record)

`CommonDBTM` (*Common DataBase Table Manager*) é a **classe-base persistente** do GLPI:
quase todo objeto de domínio (`Computer`, `Ticket`, `Contract`, `User`…) a estende. Combina,
num único objeto, os dados da linha e o comportamento de persistência — padrão
**Active Record**. Estende [[CommonGLPI]] (que provê a camada de abas/UI).

## Estado interno (propriedades-chave)
- `$fields` — os valores da linha atual (espelho da tabela).
- `$input` — a entrada bruta em processamento (add/update); chaves iniciadas por `_` são
  **transitórias** (não persistem, servem a hooks e lógica).
- `$updates` / `$oldvalues` — deltas de uma atualização (base do histórico).
- `$dohistory` — se `true`, mudanças são registradas em [[Log e histórico de auditoria]].

## Responsabilidades
- **CRUD**: `add()`, `update()`, `delete()`, `restore()`, `purge` + `getFromDB()`.
  Ver o fluxo em [[Ciclo de vida de um item (add-update-delete)]].
- **Mapeamento tabela↔objeto**: `getTable()`, filtragem de `$input` só para colunas reais.
- **Segurança**: `canView()/canCreate()/canUpdate()/canDelete()` e `canViewItem()` —
  integra [[Perfis e Direitos (RBAC)]].
- **Entidade**: `isEntityAssign()`, `maybeRecursive()`, `checkEntity()` —
  integra [[Modelo de Entidades (multi-tenancy)]].
- **Extensibilidade**: dispara hooks de plugin ([[Sistema de Plugins (Hooks)]]).
- **Automação**: `date_creation`/`date_mod` automáticos, unicidade (`checkUnicity`),
  mensagens de UI, criação automática de Infocom.

> [!note] Convenção transversal
> Como praticamente todo o domínio herda de `CommonDBTM`, os mecanismos aqui (direitos,
> entidade, histórico, hooks, busca) valem **por padrão** para todos os módulos seguintes.
> As notas de cada módulo referenciam esta.
