---
title: Interfaces de abertura de chamado
aliases: [Interfaces de abertura de ticket, Helpdesk anônimo]
tags: [assistance, ticket, opening, interface, helpdesk]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-b1-002 · Ferramentas e interfaces de abertura de chamado|EV-2-b1-002]]"
  - "[[EV-2-b1-003 · Campos específicos da abertura na interface simplificada|EV-2-b1-003]]"
  - "[[EV-2-b1-004 · Abertura padrão, por e-mail e automática|EV-2-b1-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Interfaces de abertura de chamado

O GLPI oferece três interfaces gráficas distintas para abrir um chamado, além dos canais e-mail e recorrente.

## Interface anônima
Acessível em `front/helpdesk.html` a **usuários não autenticados**, se a configuração geral permitir. Permite enviar um formulário de sinalização de incidente ao help desk; após o envio, um e-mail confirma a abertura. Por padrão, o ticket é criado na **entidade raiz**. O formulário é customizável editando diretamente `helpdesk.html`.

## Interface simplificada
Formulário leve para um **usuário final autenticado** abrir rapidamente um chamado, para si ou por delegação. Pode exibir mensagem convidando a verificar dados pessoais (localização, telefone). Ver [[Campos específicos da abertura simplificada]] e [[Interface Simplificada (Helpdesk-Self-Service)]] (E1).

## Interface padrão
Formulário completo, acessado via menu **Assistance > Ticket** e botão "+". Suporta demanda de validação já na abertura e exibe contadores de tickets ao selecionar atores/itens. Ver [[Interface Padrão (Standard)]] (E1).

> [!note] Templates de campo
> Quando [[Templates de tickets|templates]] são usados, campos como conteúdo, título e categoria podem ser tornados **obrigatórios, predefinidos ou mascarados**. Um campo obrigatório faltante impede a abertura.

## Ver também
- [[Abertura de um chamado (fluxo)]]
- [[Interface padrão vs simplificada]] (E1)
