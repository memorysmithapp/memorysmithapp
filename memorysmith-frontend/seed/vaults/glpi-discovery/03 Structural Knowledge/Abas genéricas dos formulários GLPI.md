---
title: Abas genéricas dos formulários GLPI
aliases: [abas genéricas, generic tabs, tabs do formulário]
tags: [tabs, formulario, ui, estrutura]
type: concept
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-g2-001 · Aba All (todas as informações numa página)|EV-2-g2-001]]"
  - "[[EV-2-g2-006 · Aba Documents (documentos anexados ao item)|EV-2-g2-006]]"
  - "[[EV-2-g2-008 · Aba History (histórico de alterações do item)|EV-2-g2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O formulário de qualquer objeto do GLPI (computador, impressora, ticket, contrato, fornecedor etc.) é organizado em **abas**. Além das abas específicas de cada tipo, existe um conjunto de **abas genéricas** que reaparecem em muitos objetos, oferecendo funções transversais de vínculo, documentação, rastreabilidade e gestão.

> [!note] Abas genéricas cobertas por esta descoberta
> - [[Aba Todas as informações (All)]] — consolida todas as abas numa página.
> - [[Aba Depuração (Debug)]] — informação técnica (só com modo Debug ligado).
> - [[Aba Documentos (Documents) anexados]] — anexos/arquivos.
> - [[Aba Notas (Notes) em texto livre]] — anotações livres.
> - [[Aba Histórico (History) de alterações]] — trilha de auditoria.
> - [[Aba Links externos (External links)]] — URLs contextuais.
> - [[Aba Itens (Items) vinculados]] — ativos relacionados.
> - [[Aba Contratos (Contracts) associados]] — contratos vinculados.
> - [[Aba Contatos (Contacts) associados]] — contatos vinculados.
> - [[Aba Fornecedores (Suppliers) vinculados]] — fornecedores vinculados.
> - [[Aba Tickets vinculados]], [[Aba Problemas (Problems) vinculados]], [[Aba Mudanças (Changes) vinculadas]] — objetos ITIL vinculados.
> - [[Aba Gestão (Management) financeira e administrativa]] — dados financeiros.
> - [[Aba Modelos (Templates) para gerar objeto]] — instanciação por modelo.

As abas genéricas materializam, na interface, conceitos já modelados no código: os vínculos (ver [[Vínculos entre objetos ITIL (tipos de ligação)]]), os documentos (ver [[Documentos (Document)]]) e o ciclo de vida com histórico (ver [[Ciclo de vida de um item (add-update-delete)]]).

Relaciona-se com [[Áreas da Interface do GLPI]], [[Abas do formulário de Ticket]] e [[Operações de interface sobre itens (criar, modificar, exibir, excluir)]].
