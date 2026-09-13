---
title: Aba Histórico (History) de alterações
aliases: [aba History, History tab, histórico, historical]
tags: [tabs, history, auditoria, ui]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-g2-008 · Aba History (histórico de alterações do item)|EV-2-g2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A aba **History** (Histórico) mostra as alterações feitas em um item, funcionando como trilha de auditoria. Cada entrada registra ID da alteração, data/hora, usuário responsável, campo alterado e descrição da mudança.

A descrição traz ou a **diferença** entre o valor antigo e o novo (ex.: localização mudou de "HQ" para "Remote Office A"), ou a **explicação da ação** (ex.: desinstalação de "Gimp 2.0"). Quando o campo de usuário está vazio, a ação foi **automática** (ex.: atualização por inventário automático — ver [[Fluxo de inventário nativo]]).

> [!note] Herança pai/filho
> Para dropdowns ou objetos com relação pai/filho, a modificação de um filho aparece no histórico do elemento pai.

Reflete, na interface, o registro descrito em [[Ciclo de vida de um item (add-update-delete)]]. Campos detalhados em [[Campos do histórico de alterações]]. Faz parte das [[Abas genéricas dos formulários GLPI]].
