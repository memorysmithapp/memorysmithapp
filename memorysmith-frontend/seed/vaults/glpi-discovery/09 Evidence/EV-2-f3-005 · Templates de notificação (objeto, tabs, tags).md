---
title: EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)
aliases: [EV-2-f3-005]
tags: [evidence, template, notificacao, tags, traducao]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/notifications/templates.rst · Notification templates"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-005 · Templates de notificação (objeto, tabs, tags)

> [!quote] templates.rst · "Notification templates"
> Um template é um **objeto global** do GLPI que define a informação incluída numa notificação e sua formatação. A criação é operação complexa que impacta os usuários; por isso, templates só podem ser modificados por Administradores com permissão *Update* no direito *Config*. Um template **não é ligado a uma entidade**, portanto não é possível delegar sua gestão a um administrador de subentidade. Um template pode estar disponível em várias línguas via mecanismo de tradução; o uso de **tags** (marcadores independentes da língua) permite criar uma tradução genérica. O GLPI vem com templates pré-definidos para todas as notificações (tickets, reservas, informações financeiras, cartuchos, consumíveis, licenças, sincronização MySQL...).

> [!quote] Parâmetros — aba "Notification template" (1ª aba)
> - **Name**: nome do template.
> - **Type**: tipo de objeto GLPI ao qual o template se refere.
> - **Comments** (opcional): informação adicional.
> - **CSS** (opcional): folha de estilo usada em HTML.
> Nota: templates são globais, não definidos por entidade (ao contrário das notificações).

> [!quote] Aba "Template translation"
> Lista as notificações por língua e permite adicionar novas.
> - **Language**: língua da tradução. Sem língua selecionada, a tradução vira a **default** do template (aplicável a todas as línguas sem tradução própria).
> - **Subject**: assunto do e-mail.
> - **Email text body**: texto plano sem layout (usado quando HTML não é permitido; se vazio, é gerado a partir do corpo HTML).
> - **Email HTML body**: texto com layout HTML.

> [!quote] Tags — exibem dados do objeto que disparou a notificação
> Uma tag é delimitada por **##** no início e no fim. Tipos:
> - **Simple**: ``##<object>.<field>##`` — valor do campo de um objeto GLPI.
> - **Label**: ``##lang.<object>.<field>##`` — rótulo traduzido do campo.
> - **Condition**: testa se um campo tem valor — ``##IF<object>.<field>##`` ... ``##ENDIF<object>.<field>##``; ou valor = V — ``##IF<object>.<field>=<V>##`` ... ``##ENDIF<object>.<field>##``.
> - **Loop**: exibe sub-objetos — ``##FOREACH<objects>##`` ... ``##ENDFOREACH<objects>##``; primeiros N — ``##FOREACH FIRST <N> <objects>##``; últimos N — ``##FOREACH LAST <N> <objects>##``.

## Sustenta
- [[Template de notificação (objeto global)]]
- [[Sintaxe de tags de template de notificação]]
- [[Campos do template de notificação]]
