---
title: EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo
aliases: [EV-2-f3-007]
tags: [evidence, crontask, acao-automatica, cron, cli, agendamento]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/crontasks.rst · Configure automatic actions"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo

> [!quote] crontasks.rst · "Configure automatic actions"
> O GLPI tem várias **ações automáticas** (também chamadas *crontasks*): jobs agendados periodicamente. Podem rodar em frequência específica e em modo **GLPI** ou **CLI**. No modo GLPI, disparam ocasionalmente quando usuários navegam. No modo CLI, rodam em sessão própria via cron, Tarefas Agendadas ou outro agendador externo. Algumas ações suportam só um dos modos.

> [!quote] Configuração do modo CLI e execução forçada
> Modo CLI: configurar o agendador externo para chamar `front/cron.php` periodicamente; recomendado a cada minuto. Linux/MacOS (crontab do usuário do webserver): ``* * * * * php GLPI/front/cron.php``. Forçar uma ação: ``php GLPI/front/cron.php --force mailgate`` (roda mesmo fora do agendamento).

> [!quote] Ações padrão (default actions) — nome (classe) · função
> - **alertnotclosed** (Ticket): alerta de tickets abertos há N dias sem fechamento (N por entidade). Requer notificações.
> - **cartridge** (CartridgeItem): alerta de estoque de cartuchos abaixo do limiar (por cartucho). Requer notificações.
> - **certificate** (Certificate): alerta de certificados a expirar (prazo por entidade). Requer notificações.
> - **checkAllUpdates** (Glpi\Marketplace\Controller): verifica atualizações de plugins instalados (via marketplace). Notifica se habilitado, senão registra no log.
> - **checkdbreplicate** (DBconnection): checa status/sincronia dos réplicas de BD; notifica/loga problemas.
> - **checkupdate** (CronTask): checa nova versão do GLPI.
> - **circularlogs** (CronTask): remove logs em `files/_log` mais antigos que N dias (configurável na própria ação).
> - **cleanorphans** (Document): apaga documentos não associados a itens (não considera links diretos em tarefas/comentários).
> - **cleanorphans** (Glpi\Inventory\Inventory): apaga arquivos de submissão de inventário sem ativo relacionado.
> - **cleansoftware** (CleanSoftwareCron): apaga versões de software sem instalação e softwares sem versão.
> - **cleantemp** (Glpi\Inventory\Inventory): apaga arquivos temporários de inventário com +12h.
> - **closeticket** (Ticket): fecha tickets resolvidos após certo tempo de trabalho (por entidade; considera o calendário da entidade).
> - **consumable** (ConsumableItem): alerta de estoque de consumíveis abaixo do limiar. Requer notificações.
> - **contract** (Contract): alerta de contratos a expirar (prazo por entidade); loga mesmo sem notificações.
> - **countAll** (SavedSearch): atualiza tempo estimado de execução das buscas salvas.
> - **createinquest** (Ticket): cria pesquisas de satisfação após certo tempo e as fecha após certo tempo (durações por entidade).
> - **DomainsAlert** (Domain): alerta de domínios a expirar; loga mesmo sem notificações.
> - **graph** (CronTask): limpa gráficos gerados com +1h (só criados antes da v9.2).
> - **infocom** (Infocom): alerta de garantias (aba Management do ativo) a expirar; loga sem notificações; só para ativos não deletados.
> - **logs** (CronTask): limpa entradas antigas de log de ações automáticas (retenção por ação).
> - **mailgate** (MailCollector): recupera e-mails das caixas configuradas e cria tickets a partir do e-mail.
> - **mailgateerror** (MailCollector): alerta de erros na coleta de e-mails pelos coletores.
> - **olaticket** (OlaLevel_Ticket): avalia níveis de OLA dos tickets.
> - **passwordexpiration** (User): alerta de senhas expiradas e desativa contas afetadas.
> - **pendingreason_autobump_autosolve** (PendingReasonCron): adiciona followups automáticos a tickets pendentes; auto-resolve se não houver resposta após N lembretes.
> - **planningrecall** (PlanningRecall): lembretes de eventos planejados.
> - **PurgeLogs** (PurgeLogs): apaga dados históricos antigos (retenção global, alguns tipos configuráveis).
> - **purgeticket** (Ticket): purga tickets fechados há certo tempo (prazo por entidade).
> - **queuednotification** (QueuedNotification): tenta enviar todas as notificações da fila; registra falhas e retenta; cancela após falhas contínuas.
> - **queuednotificationclean** (QueuedNotification): apaga notificações mais antigas que N dias (configurável).
> - **RecurrentItems** (CommonITILRecurrentCron): cria tickets/mudanças recorrentes agendados.
> - **reservation** (ReservationItem): alerta de fim de reservas.
> - **savedsearchesalerts** (SavedSearch_Alert): alerta de buscas salvas.
> - **session** (CronTask): apaga arquivos de sessão expirados.
> - **slaticket** (SlaLevel_Ticket): avalia níveis de SLA dos tickets.
> - **software** (SoftwareLicense): alerta de licenças de software a expirar (prazo por entidade). Requer notificações.
> - **telemetry** (Telemetry): envia informações de telemetria.
> - **temp** (CronTask): limpa arquivos temporários com +1h.
> - **unlockobject** (ObjectLock): remove locks de itens mais antigos que N horas (configurável na ação).
> - **watcher** (CronTask): monitora a execução das demais ações automáticas; notifica em caso de erro.

> [!quote] Abas do formulário e ações
> Aba **Automatic action**: configura Run frequency, Status (desabilitar), Run mode, Run period (ex.: desabilitar à noite), Number of days de retenção dos logs; permite resetar a data de execução e forçar execução manual. Alguns têm parâmetros próprios (ex.: máximo de e-mails por vez na ação mailqueue). Plugins podem definir suas próprias ações automáticas. Aba **Statistics**: nº de execuções, datas e durações (mín/máx/média/total). Aba **Logs**: últimas execuções (com detalhe por data). Ação **Reset last run**: limpa a última execução.

## Sustenta
- [[Catálogo de ações automáticas (crontasks)]]
- [[Configuração do modo CLI de ações automáticas (cron.php)]]
- [[Parâmetros de configuração de uma ação automática]]
