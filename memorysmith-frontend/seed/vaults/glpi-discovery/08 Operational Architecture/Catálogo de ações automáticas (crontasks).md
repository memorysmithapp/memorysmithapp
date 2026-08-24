---
title: Catálogo de ações automáticas (crontasks)
aliases: [Automatic actions, Crontasks catalog, Default actions]
tags: [operacao, crontask, acao-automatica, cron, agendamento, catalogo]
type: infra
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo|EV-2-f3-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Catálogo de ações automáticas (crontasks)

As **ações automáticas** (*crontasks*) são jobs agendados periodicamente. Cada uma roda em modo **GLPI** (disparado ocasionalmente pela navegação) ou **CLI** (agendador externo). Configuração e parâmetros em [[Parâmetros de configuração de uma ação automática]]; setup do CLI em [[Configuração do modo CLI de ações automáticas (cron.php)]]. Corresponde ao componente de código [[Ações Automáticas (CronTask)]].

## Catálogo (ação · classe · função)
**Alertas de estoque/expiração** (a maioria exige notificações habilitadas):
- `cartridge` (CartridgeItem), `consumable` (ConsumableItem) — estoque abaixo do limiar.
- `certificate` (Certificate), `contract` (Contract), `software` (SoftwareLicense), `infocom` (Infocom — garantias), `DomainsAlert` (Domain), `reservation` (ReservationItem) — expiração/fim próximos. Alguns logam mesmo sem notificações.
- `alertnotclosed` (Ticket) — tickets abertos há N dias sem fechamento.
- `savedsearchesalerts` (SavedSearch_Alert) — alertas de [[Configuração de Alertas em Buscas Salvas|buscas salvas]].
- `planningrecall` (PlanningRecall) — lembretes de eventos planejados.

**Ciclo de vida de tickets:**
- `closeticket` (Ticket) — fecha tickets resolvidos após tempo de trabalho (ver [[Fechamento automático e administrativo de tickets]]).
- `purgeticket` (Ticket) — purga tickets fechados há certo tempo.
- `createinquest` (Ticket) — cria/fecha [[Pesquisa de satisfação (fluxo)|pesquisas de satisfação]].
- `pendingreason_autobump_autosolve` (PendingReasonCron) — followups automáticos e auto-resolução de pendentes.
- `RecurrentItems` (CommonITILRecurrentCron) — cria [[Tickets recorrentes (fluxo)|tickets/mudanças recorrentes]].
- `slaticket` (SlaLevel_Ticket), `olaticket` (OlaLevel_Ticket) — avaliam [[Escalonamento de SLA-OLA (níveis e ações)|níveis de SLA/OLA]].

**Notificações e e-mail:**
- `queuednotification` (QueuedNotification) — envia a fila de notificações.
- `queuednotificationclean` (QueuedNotification) — apaga notificações antigas.
- `mailgate` (MailCollector) — importa e-mails e cria tickets (ver [[Receiver (coletor de e-mail) — visão de configuração]]).
- `mailgateerror` (MailCollector) — alerta erros de coleta.

**Manutenção/limpeza:**
- `circularlogs`, `logs`, `PurgeLogs`, `session`, `temp`, `graph` (CronTask/PurgeLogs) — limpeza de logs, sessões, temporários, gráficos.
- `cleanorphans` (Document / Inventory), `cleansoftware` (CleanSoftwareCron), `cleantemp` (Inventory) — remoção de órfãos/temporários.
- `countAll` (SavedSearch) — atualiza tempo estimado de buscas salvas.
- `unlockobject` (ObjectLock) — remove locks de itens antigos.

**Infra/monitoramento:**
- `checkupdate` (CronTask), `checkAllUpdates` (Marketplace) — checa novas versões do GLPI e de plugins.
- `checkdbreplicate` (DBconnection) — status/sincronia dos réplicas de BD.
- `passwordexpiration` (User) — senhas expiradas e desativação de contas.
- `telemetry` (Telemetry) — envia telemetria.
- `watcher` (CronTask) — monitora as demais ações; notifica em erro (exige notificações configuradas).

Plugins podem definir suas próprias ações automáticas.

## Ver também
- [[Fluxo de notificação por e-mail (visão do usuário)]]
- [[Arquitetura de execução (request lifecycle)]]
