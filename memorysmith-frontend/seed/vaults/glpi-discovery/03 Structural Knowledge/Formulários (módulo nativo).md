---
title: Formulários (módulo nativo)
aliases: [Forms, Formulários, Native forms]
tags: [formularios, forms, self-service, catalogo, doc]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta|EV-2-e2-015]]"
  - "[[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar|EV-2-e2-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Desde o **GLPI 11**, os **formulários são nativos** (o plugin *formcreator* deixa de ser necessário; formulários devem ser migrados de formcreator para forms — ver [[Migração de formcreator para formulários nativos]]).

Os formulários permitem construir interfaces de captura para usuários (inclusive self-service) que, ao serem submetidas, **criam itens** (tickets, changes, problems). Ficam em **Administration > Forms** e aparecem em **Assistance > Service catalog**.

## Estrutura de um formulário
- **Seções**, **perguntas** (com título e obrigatoriedade), comentários e layouts horizontais reorganizáveis.
- **Tipos de pergunta**: ver [[Tipos de pergunta de formulário]] e [[Objetos GLPI e dropdowns no tipo de pergunta Item]].
- **Visibilidade condicional** de perguntas (com base em respostas anteriores) e **visibilidade do botão de envio** (AND/OR).
- **Aprovação condicional** (regex em short/long answer).

## Configuração de destino
- **Service catalog** (descrição, ilustração, categoria, pin);
- **Access control** (público — incl. usuários não autenticados — ou privado por usuário/grupo/perfil);
- **Item to create** (Tickets/Changes/Problems, condicional; custom fields/autoconfig; Followup/Task/Approval);
- **Custom** (propriedades, atores, níveis de serviço, itens associados) — ver [[Fontes de valor dos campos do item criado por formulário]];
- **Form translations** (por idioma);
- **Import / Export** (XML entre instâncias, com reconciliação).

Formulários por padrão: *Report an issue* e *Request a service*.

> [!note] Ponte doc×código
> Relaciona-se com o processo [[Gestão de Incidentes e Requisições (processo)]] e com [[Templates de tickets]]. Ver também o fluxo [[Criação e submissão de um formulário (fluxo)]].
