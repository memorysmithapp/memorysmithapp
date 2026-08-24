---
title: Certificado na interface (Certificate) — visão do usuário
aliases: [Certificate, Certificado]
tags: [concept, management, certificate, doc]
type: concept
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-009 · Certificados — objetivos, campos e abas|EV-2-d1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Certificado na interface (Certificate) — visão do usuário

Objeto do módulo Management que representa um certificado (criptográfico/digital), modelado como um ativo. Suporta template. Tem **campos básicos** de ativo (Status, Location, técnico/grupo responsável, série, usuário, fabricante, etc.) e **campos específicos** de certificado (Root CA, autoassinado, DNS name/suffix, CSR, conteúdo PEM). Ver [[Campos do formulário de Certificado]].

Abas:
- **Items** — outros itens GLPI ligados (add manual pelo dropdown);
- **Domains** — domínios de Internet associados (podem ligar a tickets/problems/changes);
- **Management** — informações financeiras e administrativas;
- **Contracts** — contratos associados;
- **Documents** — arquivos anexados;
- **Note** — texto livre;
- Historical, All.

Um certificado também pode ser anexado a uma [[Licença na interface (License) — visão do usuário|licença]] (aba Certificates da licença).

> [!note] Ponte doc×código
> A aba Management corresponde a [[Infocom (dados financeiros do ativo)]]; Contracts a [[Contratos (Contract)]]. Não há nota de código dedicada a Certificate nas notas existentes.
