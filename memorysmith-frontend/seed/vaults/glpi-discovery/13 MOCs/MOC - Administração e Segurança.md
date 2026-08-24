---
title: MOC - Administração e Segurança
aliases: [MOC Admin, Índice Módulo 5, MOC Segurança]
tags: [moc, dominio/admin]
type: moc
maturity: evergreen
reviewed: false
author: CAD Discovery
created: 2026-07-10
---

# MOC - Administração e Segurança (Módulo 5)

Mapa de conteúdo de **usuários, acesso, autenticação, regras e conhecimento**.

## Processos (por que existe)
- [[Gestão de Usuários e Acesso (processo)]]
- [[Autenticação e Single Sign-On (processo)]]
- [[Motor de Regras de Negócio (capacidade)]]
- [[Base de Conhecimento (processo)]]

## Estrutura (como é composto)
- [[Usuários e Grupos]]
- [[Perfis × Entidades (Profile_User)]]
- [[Autenticação (Auth)]]
- [[Motor de Regras (engine)]]
- [[Tipos de Regra]]
- [[Base de Conhecimento (KnowbaseItem)]]

## Comportamento (como funciona)
- [[Fluxo de login e provisionamento]]
- [[Execução de uma regra (criteria → action)]]

## Views
- [[RBAC User×Profile×Entity (view)]]
- [[Fluxo de login e provisionamento]]

## Investigações abertas
- [[INV-1-009 · Catálogo de critérios e ações por tipo de regra]]
- [[INV-1-005 · Regras exatas de transição de status por perfil]] (matriz por perfil)

## Evidências
EV-1-028 a EV-1-033 — ver [[Registro de Evidências]].

## Conexões
Base de segurança de [[MOC - Foundation]] (direitos, entidades); o motor de regras alimenta
[[MOC - Service Desk]] (RuleTicket) e [[MOC - Ativos e Inventário]] (RuleAsset/RuleImportAsset).
