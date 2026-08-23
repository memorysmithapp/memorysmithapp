---
title: INV-2-g1-002 · Estados e limiares de saúde do endpoint de status não documentados
aliases: [INV-2-g1-002]
tags: [investigation, consumidor/cad, status, health-check, monitoramento, operacional]
type: investigation
status: open
source: "SRC-002 · advanced/status.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Dúvida

A documentação (`advanced/status.rst`) descreve **quais serviços** o endpoint `/status.php` e o comando `glpi:system:status` monitoram (db, cas, ldap, imap, mail_collectors, crontasks, filesystem, plugins) e o formato de saída (**JSON**), mas **não especifica**:

- Quais **estados/valores de saúde** cada serviço retorna (ex.: OK / degradado / erro), nem seus rótulos exatos no JSON.
- Os **limiares** que definem um serviço como saudável ou não (ex.: atraso de crontask, réplicas de banco fora de sincronia).
- O formato do **status agregado** (há um estado global consolidado?).
- A lista é declarada **"não exaustiva"** — não se sabe o conjunto completo de serviços.

## O que investigar

Cruzar com o código que gera o `/status.php` / `Glpi\System\Status` para levantar o schema JSON exato e os critérios de saúde — insumo essencial para configurar monitoração externa.

## Disparador

Lacuna de documentação notada pelo subagente g1 (sessão 2). Ver [[Monitoramento de Status e Health Check]].
