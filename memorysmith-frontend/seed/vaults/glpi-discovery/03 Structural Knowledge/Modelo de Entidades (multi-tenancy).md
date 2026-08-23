---
title: Modelo de Entidades (multi-tenancy)
aliases: [Entidades, Entity, Multi-tenancy, Separação de entidades]
tags: [concept, multi-tenancy, dominio/foundation]
type: concept
status: confirmed
source: "[[EV-1-003 · Entity é árvore com herança de configuração|EV-1-003]]"
author: CAD Discovery
created: 2026-07-10
---

# Modelo de Entidades (multi-tenancy)

A **entidade** (`Entity`) é a unidade de **isolamento organizacional** do GLPI — o mecanismo
de multi-tenancy que permite gerir várias organizações/departamentos numa mesma instância.

## Estrutura
- `Entity` estende [[CommonTreeDropdown (dropdowns em árvore)]] → é uma **árvore**
  (entidade-pai, filhas, `completename`). Ex.: `Matriz > Filial SP > TI`.
- Cada item de domínio carrega `entities_id` (a que entidade pertence) e, quando aplicável,
  `is_recursive` (visível às sub-entidades). Ver `isEntityAssign()`/`maybeRecursive()` em
  [[CommonDBTM (Active Record)]].

## Visibilidade
Um usuário atua numa entidade ativa (e suas descendentes, conforme perfil recursivo). O
[[Motor de Busca (Search Engine)]] e os `can*` aplicam automaticamente o filtro por
`entities_id`, de modo que dados de uma entidade não vazam para outra.

## Herança de configuração
Muitas configurações têm valor especial `CONFIG_PARENT (-2)`: quando encontrado,
`Entity::getUsedConfig()` **sobe a árvore** até achar um valor concreto (ver
[[Herança de configuração por entidade]]). Isso permite definir uma política na matriz e
sobrescrevê-la pontualmente numa filial.

> [!question] A aprofundar (Módulo 5)
> Regras de atribuição automática de entidade (RuleEntity) e o cruzamento
> Perfil × Entidade × Usuário (`Profile_User`).
