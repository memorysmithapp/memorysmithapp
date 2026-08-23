---
title: Configuração do Módulo de Assistência (Setup)
aliases: [Assistance configuration, Config de assistência]
tags: [configuracao-geral, assistencia, service-desk, operacao]
type: capability
status: confirmed
source: "[[EV-2-f1-008 · Configuração de assistência|EV-2-f1-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Assistance** (Setup > General) para a configuração global da parte de assistência (service desk) — ver [[Módulo de Assistência (Service Desk)]].

## Parâmetros
- **Step for the hours (minutes)**: intervalo entre passos nos dropdowns de duração.
- **Default file size limit imported by the mails receiver**: ajustar junto do [[Limite de Tamanho de Upload|management]] e do `max_upload_size` do PHP — relaciona-se ao [[Coletor de E-mail (MailCollector)]] e [[Collectors de e-mail no Assistance]].
- **Default heading when adding a document to a ticket**: classificação padrão de documentos anexados.
- **Keep tickets when purging hardware in the inventory**: mantém tickets do ativo purgado.
- **Allow anonymous ticket creation (receiver)**: desativado por padrão; necessário ao usar coletor de e-mail para criar tickets de usuários não reconhecidos.
- **Limit of the schedules for planning**: faixa horária exibida no [[Planejamento e Agenda (visões de planning)|planejamento]].
- **By default, a software may be linked to a ticket**.
- **Show personal information in new ticket form (simplified information)**: exibe nome, telefone e localização do usuário (botão Edit vai às preferências).
- **Allow anonymous followups (receiver)**: usuário ausente no GLPI pode responder a e-mail do GLPI.

## Matriz de cálculo de prioridade
Define a prioridade do ticket conforme **impacto** e **urgência**; a disponibilidade dos níveis é configurável, mas o nível **Medium não pode ser deletado**. Ver [[Priorização (urgência × impacto)]] e [[Matriz de prioridade (configuração urgência × impacto)]].
