---
title: EV-2-d1-009 · Certificados — objetivos, campos e abas
aliases: [EV-2-d1-009]
tags: [evidence, management, certificate, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/modules/management/certificates.rst · Certificates"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d1-009 · Certificados — objetivos, campos e abas

> [!quote] certificates.rst · "Certificates"
> A gestão de certificados permite: criar um inventário de todos os certificados da organização; acompanhar a instalação de certificados nos ativos; incluir certificados na gestão financeira do GLPI; antecipar e acompanhar a renovação de certificados. Suporta *template*.

> [!quote] certificates.rst · "List of basic fields"
> Campos básicos (comuns a ativos): Name, Status, Location, Technician in charge, Group in charge, Alternate username number, Serial number, Alternate username, Inventory number, User, Group, Manufacturer, Comments.

> [!quote] certificates.rst · "Description of specific fields"
> Campos específicos: **Manufacturer (Root CA)** (dropdown do fabricante do certificado); **Certificate type** (sem descrição no doc); **Self-signed** (informa se o certificado é autoassinado); **DNS name** (prefixo do nome de domínio associado — ex.: em `server.mycompany.com`, DNS name = `server`); **DNS suffix** (sufixo — ex.: `mycompany.com`); **Expiration date** (data de expiração, útil para alertas e renovação); **Command used** (armazena o comando de sistema que gerou o certificado); **Certificate Request (CSR)** (armazena o comando que gerou o arquivo CSR); **Certificate** (armazena os dados do arquivo CRT, em PEM).

> [!quote] certificates.rst · abas
> Aba **Items** (itens GLPI ligados; adicionar manualmente pelo dropdown); aba **Domains** (um domínio de Internet, com nome, data de expiração...; pode ser ligado a tickets, problems, changes); aba **Management** (informações financeiras e administrativas, visíveis na aba Management do formulário); aba **Contracts** (gestão de contratos: loan, maintenance, support...); aba **Documents** (vincular arquivos — PDF, txt, png...; anexar existente ou novo); aba **Note** (campo de texto livre, notas exibidas por ordem de criação, permite anexar documento); Historical, All.

## Sustenta
- [[Certificado na interface (Certificate) — visão do usuário]]
- [[Gestão de Certificados (capacidade)]]
- [[Campos do formulário de Certificado]]
- [[Alertas de renovação e vencimento (contratos, licenças, certificados)]]
