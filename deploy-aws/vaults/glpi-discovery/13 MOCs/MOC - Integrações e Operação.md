---
title: MOC - Integrações e Operação
aliases: [MOC Integrações, Índice Módulo 6, MOC Operação]
tags: [moc, dominio/integracoes, dominio/operacao]
type: moc
maturity: evergreen
reviewed: false
author: CAD Discovery
created: 2026-07-10
---

# MOC - Integrações e Operação (Módulo 6)

Mapa de conteúdo de **integrações** (API, e-mail, agente, plugins) e **arquitetura
operacional** (execução, cron, config, instalação).

## Integrações (com quem se comunica)
- [[API REST e GraphQL]]
- [[Notificações (e-mail e canais)]]
- [[Coletor de E-mail (MailCollector)]]
- [[Agente de Inventário (protocolo)]]
- [[Plugins e Marketplace]]

## Operação (como opera em produção)
- [[Arquitetura de execução (request lifecycle)]]
- [[Ações Automáticas (CronTask)]]
- [[Configuração e Instalação]]

## Comportamento
- [[Fluxo de notificação (event → fila → envio)]]

## Views
- [[Integrações e operação (view)]]

## Evidências
EV-1-034 a EV-1-039 — ver [[Registro de Evidências]].

## Investigações resolvidas neste módulo
- [[INV-1-001 · Roteamento Symfony vs entrypoints legados]] ✅
- [[INV-1-007 · Protocolo e endpoint do agente de inventário]] ✅
- [[INV-1-008 · Alertas e crons de vencimento]] ✅ (mecanismo)
