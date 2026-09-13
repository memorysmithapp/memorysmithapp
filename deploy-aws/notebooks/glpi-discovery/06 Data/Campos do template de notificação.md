---
title: Campos do template de notificação
aliases: [Notification template fields]
tags: [dados, template, campos, traducao, notificacao]
type: entity
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)|EV-2-f3-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do template de notificação

Campos de um [[Template de notificação (objeto global)]], distribuídos em duas abas.

## Aba "Notification template" (1ª aba)
| Campo | Significado |
|---|---|
| Name | Nome do template. |
| Type | Tipo de objeto GLPI ao qual o template se relaciona. |
| Comments (opcional) | Informação adicional. |
| CSS (opcional) | Folha de estilo usada no template HTML. |

## Aba "Template translation" (por língua)
| Campo | Significado |
|---|---|
| Language | Língua da tradução; sem língua = **Default translation** (aplicável a todas as línguas sem tradução própria). |
| Subject | Assunto do e-mail. |
| Email text body | Texto plano sem layout (usado quando HTML não é permitido; se vazio, gerado a partir do corpo HTML). |
| Email HTML body | Texto com layout HTML. |

O conteúdo usa a [[Sintaxe de tags de template de notificação]].

## Ver também
- [[Campos da definição de notificação]]
