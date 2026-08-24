---
title: Perfis de transferência inter-entidades
aliases: [Transfer profiles, Transfer]
tags: [entidades, transferencia, regras, doc]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-008 · Tipos de regra na administração e mecanismos auxiliares|EV-2-e2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O menu **Transfer** define **perfis de transferência inter-entidades**, que determinam o que acontece com cada item ligado ao objeto transferido.

## Ações possíveis por item
- **Preserve**: o item é transferido junto com o objeto;
- **Put in Trash Bin**: o item vai para a lixeira da entidade cedente;
- **Delete Permanently**: o item é removido da base;
- **Keep**: o item permanece na entidade cedente;
- **Disconnect**: a conexão entre elemento e objeto é removida.

Usado quando um item muda de entidade (manualmente ou pelo modelo de transferência automática por inventário configurado na aba *Assets* da entidade — ver [[Abas de configuração da Entidade]]).

> [!note] Ponte doc×código
> Corresponde ao processo E1 [[Transferência de itens entre entidades (processo)]].
