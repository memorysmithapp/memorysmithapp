---
title: INV-2-e2-002 · Terminologia Approval em formulários (aprovação vs validação)
aliases: [INV-2-e2-002]
tags: [investigation, consumidor/cad, formularios, terminologia]
type: investigation
maturity: seed
reviewed: false
source: "[[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar|EV-2-e2-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!question] Pergunta
> No módulo de Formulários, o termo "Approval" é usado com dois sentidos aparentemente distintos — qual corresponde a cada mecanismo no código?

Em `forms.rst` o termo **Approval** aparece em contextos diferentes:
1. **"Conditional Approval"** e **"error during Approval"**: parece descrever a **validação do preenchimento** do campo pelo usuário (regex forçando formato), não uma aprovação ITIL.
2. **"Followup / Task / Approval"** (item a criar) e "For Approval, you can add a specific actor…": aqui **Approval** parece ser a **solicitação de validação/aprovação ITIL** do item criado (validação por um ator).

## Por que é relevante
A documentação possivelmente mistura "validation" (validação de formulário / submit) com "approval/validation" (fluxo de aprovação ITIL do ticket). Isto pode gerar ambiguidade ao mapear para o código e para o processo [[Validação e aprovação (regra)]].

## O que verificar
- No código, distinguir a validação de campo do formulário (front-end) da criação de uma **solicitação de aprovação** no item.
- Confirmar se "Conditional Approval" é apenas validação de entrada (regex) e não gera aprovação ITIL.

> [!note] Encaminhamento
> Cruzar com [[Validação e aprovação (regra)]] e com o fluxo [[Criação e submissão de um formulário (fluxo)]].
