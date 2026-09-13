---
title: MOC - Foundation
aliases: [MOC Foundation, Índice Módulo 1]
tags: [moc, dominio/foundation]
type: moc
maturity: evergreen
reviewed: false
author: CAD Discovery
created: 2026-07-10
---

# MOC - Foundation (Módulo 1)

Mapa de conteúdo do **núcleo/fundação** do GLPI — os mecanismos transversais que todos os
demais módulos herdam.

## Overview
- [[Visão Geral do GLPI]]
- [[Tecnologias e requisitos de plataforma]]
- [[Glossário]]

## Estrutura (como é composto)
- [[CommonDBTM (Active Record)]] — base persistente de todo o domínio
- [[Modelo de Entidades (multi-tenancy)]]
- [[Perfis e Direitos (RBAC)]]
- [[Motor de Busca (Search Engine)]]
- [[Kernel e Bootstrap]]
- [[Sistema de Plugins (Hooks)]]
- [[Organização do código-fonte]]

## Comportamento (como funciona)
- [[Ciclo de vida de um item (add-update-delete)]]

## Decisões
- [[ADR - Arquitetura híbrida Symfony + Active Record legado]]

## Views
- [[Camadas da arquitetura (view)]]
- [[Ciclo de vida CommonDBTM (view)]]

## Investigações abertas
- [[INV-1-001 · Roteamento Symfony vs entrypoints legados]]
- [[INV-1-002 · Catálogo completo de hooks de plugin]]
- [[INV-1-003 · Comportamento de produção via plugins fora do repo]]

## Evidências
Ver [[Registro de Evidências]] · EV-1-001 a EV-1-007.
