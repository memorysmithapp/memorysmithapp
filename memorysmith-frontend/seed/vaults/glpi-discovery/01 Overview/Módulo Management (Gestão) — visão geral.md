---
title: Módulo Management (Gestão) — visão geral
aliases: [Management, Gestão, Módulo de Gestão]
tags: [overview, management, doc]
type: overview
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-001 · Índice do módulo Management e itens geridos|EV-2-d1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Módulo Management (Gestão) — visão geral

O **Management** é o módulo do GLPI que reúne itens de gestão administrativa, financeira e de infraestrutura de rede. Na perspectiva do usuário, ele complementa os ativos: aqui vivem os objetos que dão contexto contratual, financeiro e documental aos ativos gerenciados.

Itens do módulo (conforme o índice): **licenças** de software, **orçamentos** (budgets), **fornecedores** (suppliers), **certificados**, **contatos**, **contratos**, **documentos**, além de linhas, data centers, clusters, domínios, registros de domínio, appliances e bases de dados (fora desta fatia).

Esta fatia da descoberta documental cobre os sete itens de natureza administrativa/financeira/documental:

- [[Contrato na interface (Contract) — visão do usuário]]
- [[Fornecedor na interface (Supplier) — visão do usuário]]
- [[Contato na interface (Contact) — visão do usuário]]
- [[Orçamento na interface (Budget) — visão do usuário]]
- [[Documento na interface (Document) — visão do usuário]]
- [[Licença na interface (License) — visão do usuário]]
- [[Certificado na interface (Certificate) — visão do usuário]]

> [!note] Ponte doc×código
> No modelo do código, esses conceitos correspondem a [[Contratos (Contract)]], [[Fornecedores e Contatos]], [[Orçamentos e Custos]], [[Documentos (Document)]], [[Software, Versões e Licenças]] e [[Infocom (dados financeiros do ativo)]].

Quatro dos itens (contratos, licenças, certificados, orçamentos) partilham o mesmo eixo de **gestão financeira**: valores, custos, integração com orçamentos e alertas de renovação/vencimento.
