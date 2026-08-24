---
title: INV-2-d1-002 · Campo "Certificate type" sem descrição no doc
aliases: [INV-2-d1-002]
tags: [investigation, consumidor/cad, management, certificate, doc, gap]
type: investigation
status: open
maturity: seed
reviewed: false
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-d1-002 · Campo "Certificate type" sem descrição no doc

Na seção "Description of specific fields" de `certificates.rst`, o campo **Certificate type** aparece listado, porém **sem texto de descrição** (a linha termina com dois-pontos e nada depois):

> [!quote] certificates.rst
> "**Certificate type** :"

> [!question] Dúvida
> Qual a semântica de *Certificate type*? Presumivelmente um [[Dropdown (lista suspensa customizável)|dropdown]] customizável (à semelhança de contract type / budget type). Confirmar contra o código/UI se é dropdown configurável e quais valores padrão existem.
