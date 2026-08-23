---
title: Criação e submissão de um formulário (fluxo)
aliases: [Form lifecycle, Fluxo de formulário]
tags: [formularios, forms, fluxo, self-service, doc]
type: flow
status: confirmed
source:
  - "[[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta|EV-2-e2-015]]"
  - "[[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar|EV-2-e2-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Lado do administrador (construção)
1. Criar o formulário em **Administration > Forms** (+ Add): título, descrição.
2. Adicionar **seções** e **perguntas** (tipo, obrigatoriedade) — ver [[Tipos de pergunta de formulário]].
3. Definir **visibilidade condicional** de perguntas, **aprovação condicional** (regex) e **visibilidade do botão de envio**.
4. Configurar o destino: **Service catalog** (categoria, ilustração, pin), **Access control** (público/privado), **Item to create** (Ticket/Change/Problem, condições, custom fields, Followup/Task/Approval) e **Custom** (propriedades, atores, níveis de serviço, itens associados) — ver [[Fontes de valor dos campos do item criado por formulário]].
5. Opcional: **traduções** e **exportar** para outra instância.

## Lado do usuário (submissão)
1. Acessa o formulário via **Assistance > Service catalog** ou home do portal self-service (respeitando o Access control).
2. Preenche as perguntas (obrigatórias validadas; perguntas condicionais aparecem/somem conforme respostas).
3. Se as condições de visibilidade do botão de envio forem atendidas, submete.
4. O GLPI **cria o(s) item(ns)** configurados (ticket/change/problem), aplicando as fontes de valor definidas (template, respostas, atores…) e eventuais follow-up/task/approval.

> [!note] Ponte doc×código
> Alimenta o processo [[Gestão de Incidentes e Requisições (processo)]] e a [[Abertura de um chamado (fluxo)]]. Regras de negócio podem depois modificar o item criado — ver [[Regras de negócio de tickets (administração)]].
