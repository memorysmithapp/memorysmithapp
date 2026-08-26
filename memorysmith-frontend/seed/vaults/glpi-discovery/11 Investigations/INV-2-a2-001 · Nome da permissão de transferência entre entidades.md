---
title: INV-2-a2-001 · Nome da permissão de transferência entre entidades
aliases: [INV-2-a2-001]
tags: [investigation, consumidor/cad, transfer, permissions, doc-gap]
type: investigation
maturity: seed
reviewed: false
source: "SRC-002 · modules/overview/actions.rst · Transfer between entities"
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-a2-001 · Nome da permissão de transferência entre entidades

> [!question] Dúvida
> Qual é o nome exato da permissão de perfil necessária para transferir itens entre entidades?

## O que disparou

A própria documentação (`actions.rst`, seção "Transfer between entities") deixa um comentário de revisão pendente:

```
.. ??? must check: correct name of the permission
```

O texto instrui a verificar que o perfil tem permissão de leitura de **Transfer** em `Administration > Profiles > Administration --> Transfer read permission`, mas marca que o nome correto da permissão precisa ser confirmado.

## Encaminhamento

Confirmar contra o código-fonte (perfil/RBAC — ver [[Perfis e Direitos (RBAC)]]) qual é a chave/label exata do direito de transferência. Relaciona-se a [[Transferência de itens entre entidades (processo)]] e [[Modelo de Entidades (multi-tenancy)]].
