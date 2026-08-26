---
title: Campos do formulário de Certificado
aliases: [Certificate fields]
tags: [data, management, certificate, fields, doc]
type: table
maturity: evergreen
reviewed: false
source: "[[EV-2-d1-009 · Certificados — objetivos, campos e abas|EV-2-d1-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos do formulário de Certificado

## Campos básicos (comuns a ativos)
Name, Status, Location, Technician in charge, Group in charge, Alternate username number, Serial number, Alternate username, Inventory number, User, Group, Manufacturer, Comments.

## Campos específicos

| Campo | Semântica |
|-------|-----------|
| **Manufacturer (Root CA)** | Dropdown do fabricante/autoridade certificadora raiz. |
| **Certificate type** | Tipo de certificado (*sem descrição no doc* — ver investigação). |
| **Self-signed** | Informa se o certificado é autoassinado. |
| **DNS name** | Prefixo do nome de domínio associado (ex.: em `server.mycompany.com` → `server`). |
| **DNS suffix** | Sufixo do nome de domínio (ex.: `mycompany.com`). |
| **Expiration date** | Data de expiração; útil para alertas e antecipar renovação. |
| **Command used** | Armazena o comando de sistema que gerou o certificado. |
| **Certificate Request (CSR)** | Armazena o comando que gerou o arquivo CSR. |
| **Certificate** | Armazena os dados do arquivo CRT (formato PEM). |

> [!note] Ponte doc×código
> Campos comuns de ativo remetem ao [[Modelo de Ativos (padrão comum)]]. Aba financeira em [[Infocom (dados financeiros do ativo)]]. Ver [[INV-2-d1-002 · Campo "Certificate type" sem descrição no doc]].
