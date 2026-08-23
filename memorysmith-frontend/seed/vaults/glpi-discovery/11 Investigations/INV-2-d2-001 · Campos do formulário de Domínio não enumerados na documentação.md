---
title: INV-2-d2-001 · Campos do formulário de Domínio não enumerados na documentação
aliases: [Campos de Domain, Domain form fields]
tags: [investigation, consumidor/cad, management, domain, campos]
type: investigation
status: open
author: CAD Discovery (doc)
created: 2026-07-12
---

# INV-2-d2-001 · Campos do formulário de Domínio não enumerados na documentação

> [!question] Lacuna de documentação
> A documentação do usuário (domains.rst) descreve o objeto [[Domínio (Internet domain)]] como tendo "its name, expire date..." mas **não enumera explicitamente** o conjunto completo de campos do formulário de um domínio (diferentemente de appliance, database instance, phone line e domain record, que têm listas de campos).

## O que disparou
`domains.rst` · seção "Domain object": apenas menciona nome e data de expiração de forma ilustrativa ("...").

## A investigar
- Quais são os demais campos do formulário de Domínio (ex.: técnico/grupo responsável, tipo de domínio, data de criação, relação com entidade, comentários)?
- Confirmar via engenharia reversa do código (SRC-001) na classe `Domain` ou via inspeção da UI.

## Possíveis fontes
- Código: modelo/tabela de `Domain` (`glpi_domains`).
- Nota de código relacionada: eventual correspondência com o [[Modelo de Ativos (padrão comum)]].
