---
title: Gestão de Certificados (capacidade)
aliases: [Certificates management]
tags: [capability, management, certificate, financial, doc]
type: capability
status: confirmed
source: "[[EV-2-d1-009 · Certificados — objetivos, campos e abas|EV-2-d1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Gestão de Certificados (capacidade)

A gestão de certificados do GLPI permite:

- **inventariar** todos os certificados da organização;
- **acompanhar** a instalação de certificados nos ativos (aba *Items*);
- **incluir** certificados na gestão financeira (aba *Management*, contratos);
- **antecipar e acompanhar** a renovação (via *Expiration date* e alertas).

O certificado é modelado como um ativo: tem campos comuns (Status, Location, técnico/grupo responsável, número de série, etc.) e campos específicos de criptografia — **Root CA (fabricante)**, autoassinado, **DNS name/suffix**, **Command used**, **CSR** e o próprio conteúdo **Certificate (PEM/CRT)**. Ver [[Campos do formulário de Certificado]].

Certificados podem ser ligados a **domínios** e a outros objetos GLPI (tickets, problems, changes), e anexados a **licenças** (a licença tem aba *Certificates*).

> [!note] Ponte doc×código
> A aba *Management* corresponde a [[Infocom (dados financeiros do ativo)]]; a aba *Contracts* liga a [[Contratos (Contract)]]. Certificado não possui nota de código dedicada nas notas existentes.

Ver [[Alertas de renovação e vencimento (contratos, licenças, certificados)]].
