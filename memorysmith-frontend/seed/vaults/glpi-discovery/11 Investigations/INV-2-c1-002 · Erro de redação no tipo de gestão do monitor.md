---
title: INV-2-c1-002 · Erro de redação no tipo de gestão do monitor
aliases: [INV-2-c1-002]
tags: [investigation, consumidor/cad, assets, monitor, doc-quality]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-c1-002 · Erro de redação no tipo de gestão do monitor

Em `monitors.rst`, a explicação de *global management* diz literalmente:

> [!quote]
> "global management make the **printer** a virtual global element that will be connected to several computers"

O termo **printer** parece ser erro de redação herdado de outra página; o contexto trata de **monitor/display**. Não é conflito doc×código, mas uma imprecisão do doc-fonte.

> [!question]
> Confirmar se a semântica de gestão global é idêntica entre monitor, periférico, telefone e impressora (todos expõem `Management type`), consolidando na nota [[Gestão unitária vs global de ativos (visão do doc)]].

Sem impacto na modelagem; registrado para rastreabilidade de qualidade do doc.
</content>
