---
title: EV-2-b1-002 · Ferramentas e interfaces de abertura de chamado
aliases: [EV-2-b1-002]
tags: [evidence, assistance, ticket, opening, helpdesk, interface]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/assistance/tickets/ticketopening.rst · Opening a ticket / Opening a ticket in GLPI"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-b1-002 · Ferramentas e interfaces de abertura de chamado

> [!quote] ticketopening.rst — "Opening a ticket"
> Um requerente que formula uma necessidade pode usar várias ferramentas:
> - preencher um **formulário online** (requerente conhecido ou não pelo GLPI);
> - pedir a um **delegado** do grupo que abra o ticket. Na interface simplificada isto aparece como opção que indica se o ticket é do próprio usuário ou de outro. Na interface padrão, o mecanismo fica ativo enquanto a autorização **See all tickets** estiver *No* no perfil; todos os usuários com delegação ativa são adicionados como requerente;
> - **contatar um operador** direto ou por telefone (o operador abre o ticket);
> - enviar a demanda por **e-mail**.

> [!quote] ticketopening.rst — "Opening a ticket in GLPI"
> Um ticket pode ser aberto:
> - pela **interface anônima** de abertura, acessível a todos os usuários não autenticados se a configuração geral do GLPI permitir;
> - pela **interface gráfica**: simplificada (formulário leve para usuário final autenticado) ou padrão (formulário completo).

> [!quote] ticketopening.rst — "Anonymous ticket opening interface"
> Interface acessível em `http:///front/helpdesk.html`; permite a usuários sem conta GLPI enviar um formulário de sinalização de incidente ao help desk. Após envio, um e-mail confirma a abertura. O formulário pode ser customizado editando diretamente o arquivo `helpdesk.html`. Por padrão o ticket é criado na **entidade raiz**.

> [!quote] ticketopening.rst — "Opening a ticket in graphical interface"
> Se templates são usados, alguns campos podem ser tornados **obrigatórios, predefinidos ou mascarados** na abertura (conteúdo, título e/ou categoria). Se um campo obrigatório faltar, o ticket não é aberto. É possível anexar um ou mais documentos numa única operação. Com a opção **Use rich text for assistance** ativa na configuração geral, o campo *Description* aceita formatação HTML e surge uma zona para drag-and-drop de imagens (ex.: prints); uma tag é adicionada automaticamente à descrição.

## Sustenta
- [[Interfaces de abertura de chamado]]
- [[Abertura de um chamado (fluxo)]]
- [[Módulo de Assistência (Service Desk)]]
