---
title: Sintaxe de tags de template de notificação
aliases: [Notification tags, Template tags]
tags: [dados, template, tags, sintaxe, notificacao]
type: entity
status: confirmed
source:
  - "[[EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)|EV-2-f3-005]]"
  - "[[EV-2-f3-006 · Exemplo de criação de template de ticket|EV-2-f3-006]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Sintaxe de tags de template de notificação

As **tags** exibem dados do objeto que disparou a notificação e são independentes da língua. Uma tag é delimitada por **`##`** no início e no fim.

| Tipo | Sintaxe | Função |
|---|---|---|
| Simple | `##<object>.<field>##` | Valor do campo de um objeto GLPI. |
| Label | `##lang.<object>.<field>##` | Rótulo traduzido do campo (auto-traduzido). |
| Condition (tem valor) | `##IF<object>.<field>## ... ##ENDIF<object>.<field>##` | Bloco exibido se o campo tem valor. |
| Condition (valor = V) | `##IF<object>.<field>=<V>## ... ##ENDIF<object>.<field>##` | Bloco exibido se o campo = V. |
| Loop (todos) | `##FOREACH<objects>## ... ##ENDFOREACH<objects>##` | Itera sub-objetos. |
| Loop (primeiros N) | `##FOREACH FIRST <N> <objects>## ... ##ENDFOREACH<objects>##` | Primeiros N. |
| Loop (últimos N) | `##FOREACH LAST <N> <objects>## ... ##ENDFOREACH<objects>##` | Últimos N. |

Exemplos concretos (template de ticket): `##ticket.action##`, `##ticket.title##`, `##ticket.status##`, `##ticket.url##`, `##ticket.authors##`, `##ticket.creationdate##`, `##ticket.description##`; rótulos `##lang.ticket.status##`, `##lang.ticket.url##`; loop de timeline `##FOREACHtimelineitems##` com `##timelineitems.author/date/description##`; condicional de status pendente `##IFticket.storestatus=4##...##ENDIFticket.storestatus##`.

> [!note] `##ticket.action##` = ação que disparou a notificação; ao assunto é adicionado automaticamente o prefixo "[GLPI <número>]".

## Ver também
- [[Template de notificação (objeto global)]]
- [[Criação de um template de notificação (passo a passo)]]
