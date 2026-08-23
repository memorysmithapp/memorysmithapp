---
title: Transferência de itens entre entidades (processo)
aliases: [Transfer, Transferência, Transfer between entities]
tags: [transfer, entities, multi-tenancy, process]
type: process
status: confirmed
source: "[[EV-2-a2-001 · Ações sobre objetos e ações em massa|EV-2-a2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Transferência de itens entre entidades (processo)

**Transferência** é a ação de mover um objeto de uma entidade para outra. As entidades permitem definir **perfis de transferência** que descrevem as ações realizadas ao mover elementos — útil, em particular, para migrar de um GLPI de entidade única para múltiplas entidades. Ver [[Modelo de Entidades (multi-tenancy)]].

## Pré-requisitos

- O perfil usado deve ter permissão de leitura de **Transfer** (`Administration > Profiles`). O nome exato da permissão é uma dúvida do próprio doc — ver [[INV-2-a2-001 · Nome da permissão de transferência entre entidades]].
- O perfil precisa de permissão na entidade de **origem** e de **destino** (a solução mais simples é um perfil recursivo a partir da entidade raiz — ver [[Recursividade em entidades]]).

## Passos

1. Configurar as ações do transfer via [[Motor de Regras de Negócio (capacidade)|regra de transferência]];
2. Garantir as permissões nas entidades de origem e destino;
3. Ir à entidade raiz (`See all`);
4. Na lista de objetos, selecionar o elemento e escolher **Add to transfer list** → **Validate** (ver [[Ações em massa (massive actions)]]);
5. Em **Transfer mode**, selecionar o perfil de configuração de transferência criado no passo 1;
6. Selecionar a entidade de destino;
7. Clicar em **Transfer** e verificar na entidade de destino.

> [!note] Elementos vinculados
> Um elemento vinculado inexistente no destino é criado automaticamente se o perfil de transferência pedir para mantê-lo. Ex.: um fornecedor existente só na entidade de origem é recriado no destino; mas um fornecedor definido na entidade raiz com recursividade não é recriado.

> [!warning]
> Localização e grupo devem ser atualizados para a entidade de destino.
