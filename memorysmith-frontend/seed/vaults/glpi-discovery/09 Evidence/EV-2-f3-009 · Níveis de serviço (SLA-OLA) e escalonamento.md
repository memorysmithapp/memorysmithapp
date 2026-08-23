---
title: EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento
aliases: [EV-2-f3-009]
tags: [evidence, sla, ola, service-level, escalonamento, escalation, calendario]
type: evidence
status: confirmed
source: "SRC-002 · modules/configuration/service_levels.rst · Service Levels"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-009 · Níveis de serviço (SLA-OLA) e escalonamento

> [!quote] service_levels.rst · "Service Levels"
> Dois tipos de acordo de nível de serviço rastreáveis no GLPI: **SLA** (Service Level Agreement — acordo entre provedor de TI e cliente) e **OLA** (Operation Level Agreement — acordo entre grupos/departamentos do provedor). Ambos podem, opcionalmente, rastrear: o tempo máximo até um ticket ter técnico atribuído, e o tempo máximo até o ticket ser resolvido.

> [!quote] Calendário e cálculo
> Um calendário pode ser associado a um SLA/OLA. Por padrão, nenhum calendário é associado e os cálculos assumem 7 dias/semana, 24h/dia; também é possível usar o calendário do ticket (da entidade). Se o tempo máximo é em **dias**, os cálculos são em dias considerando o calendário (dias úteis). Se em **horas/minutos**, considera-se o horário de funcionamento. Ex.: SLA H+4 com calendário 8h–18h, ticket aberto às 16h → vencimento às 10h do dia seguinte. Mudar o ticket para **pendente** coloca o SLA em modo *sleep*: se ficar 3h pendente, o vencimento é adiado em 3h.

> [!quote] Atribuição automática de níveis de serviço
> Um SLA/OLA pode ser atribuído automaticamente a tickets pelo **motor de regras de ticket** (ticket business rules). A associação permite o cálculo automático da data de expiração. Vários SLA/OLAs podem ser definidos e atribuídos por critérios precisos (ex.: SLA 1 para uma categoria, SLA 2 para as outras).
> **Aviso**: se um SLA/OLA é atribuído manualmente na abertura (pelo usuário ou via template de ticket), as regras de negócio **não podem** redefini-lo. Quando atribuído, é completamente *replayed* e as ações dos níveis de escalonamento são executadas.

> [!quote] Níveis de escalonamento (escalation levels)
> Após adicionar um SLA/OLA a um service level, clica-se no nome do SLA/OLA para configurá-lo, incluindo níveis de escalonamento. Ao adicionar um nível, clica-se no seu nome para configurar os critérios de disparo e as ações a tomar. Cada nível dispara ações automáticas para resolver o ticket o quanto antes; é disparado antes ou depois da data de expiração conforme o *delay* definido. Ex.: um dia antes do prazo, o ticket é atribuído ao suporte nível 2 e a prioridade muda para Alta. Níveis podem ser condicionados por critérios de disparo; sem critérios, o nível é disparado sempre; com critérios, eles são checados antes de aplicar o nível (ex.: enviar lembrete ao administrador 1 dia antes se o ticket ainda estiver em status *New* → critério `Status is New`).

## Sustenta
- [[Níveis de serviço (SLA e OLA) na configuração]]
- [[Escalonamento de SLA-OLA (níveis e ações)]]
- [[Campos de configuração de SLA-OLA e níveis de escalonamento]]
