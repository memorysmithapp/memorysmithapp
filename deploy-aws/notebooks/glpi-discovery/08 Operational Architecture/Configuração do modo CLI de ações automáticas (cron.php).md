---
title: Configuração do modo CLI de ações automáticas (cron.php)
aliases: [CLI cron mode, cron.php]
tags: [operacao, crontask, cli, cron, agendador, cron.php]
type: infra
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-f3-007 · Ações automáticas (crontasks) — config e catálogo|EV-2-f3-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Configuração do modo CLI de ações automáticas (cron.php)

As [[Catálogo de ações automáticas (crontasks)|ações automáticas]] podem rodar em dois modos:

- **GLPI mode**: disparadas ocasionalmente quando usuários navegam pela aplicação.
- **CLI mode**: rodam em sessão própria via cron, Tarefas Agendadas ou outro agendador externo. Algumas ações suportam apenas um dos modos.

## Configuração do CLI
Configurar o agendador externo para chamar `front/cron.php` periodicamente — **recomendado a cada minuto**, para que ações prontas rodem o quanto antes.

Exemplo (Linux/MacOS, no crontab do usuário do webserver, ex.: www-data/apache):

```
* * * * * php GLPI/front/cron.php
```

Substituir `GLPI` pelo caminho da instalação e, se necessário, `php` pelo caminho completo do binário.

## Forçar execução de uma ação
```
php GLPI/front/cron.php --force mailgate
```
Roda a ação especificada mesmo que ainda não esteja agendada para rodar.

## Ver também
- [[Parâmetros de configuração de uma ação automática]]
- [[Ações Automáticas (CronTask)]]
- [[Arquitetura de execução (request lifecycle)]]
