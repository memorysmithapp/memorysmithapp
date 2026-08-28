---
title: INV-2-f3-001 · Documentação de Locks (bloqueio de objetos) ausente
aliases: [INV-2-f3-001]
tags: [investigation, consumidor/cad, lock, documentacao-incompleta, stub]
type: investigation
maturity: seed
reviewed: false
source:
  - "[[EV-2-f3-011 · Páginas de Locks não redigidas (stubs)|EV-2-f3-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-f3-001 · Documentação de Locks (bloqueio de objetos) ausente

> [!question] Como o recurso de **Locks** (bloqueio de objetos) é configurado e usado do ponto de vista do administrador/usuário?

## O que disparou a dúvida
Existem **duas** páginas na documentação para o tema de *locks* na seção de configuração — `modules/configuration/locks.rst` (título "Locks") e `modules/configuration/Locks.rst` (título "lock") — e **ambas estão vazias**, contendo apenas uma diretiva `.. todo:: This page must be redacted`.

## Contexto
O recurso existe no produto e há evidência indireta:
- A ação automática **`unlockobject`** (classe `ObjectLock`) remove locks de itens mais antigos que N horas (ver [[Catálogo de ações automáticas (crontasks)]]).
- Deve existir nota de código correspondente ao mecanismo de lock de objetos.

## Lacunas / perguntas abertas
- Como um usuário adquire/libera um lock manualmente na interface?
- Qual a configuração global do recurso (habilitar/desabilitar, tipos de item sujeitos a lock, tempo de expiração padrão)?
- Relação entre o lock automático e a edição concorrente de itens.
- Por que há duas páginas duplicadas (`locks.rst` vs `Locks.rst`)? Possível problema de build/toctree além da falta de conteúdo.

> [!note] Como as páginas são stubs, nenhuma afirmação sobre a configuração de Locks pode ser feita a partir de SRC-002. A resposta deve vir da nota de código ou de validação humana.
