---
title: EV-1-002 · Constantes globais e bitmask de direitos
aliases: [EV-1-002]
tags: [evidence, dominio/foundation, seguranca, direitos]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/autoload/constants.php · linhas 43–109"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-002 · Constantes globais e bitmask de direitos

> [!quote] `src/autoload/constants.php` (L43–109, resumido)
> ```php
> define('GLPI_VERSION', '11.0.7');
> define('GLPI_MIN_PHP', '8.2');
> define('GLPI_MAX_PHP', '8.5');
> define('NS_GLPI', 'Glpi\\');
> define('NS_PLUG', 'GlpiPlugin\\');
>
> // rights (bitmask)
> define("READ", 1);   define("UPDATE", 2);   define("CREATE", 4);
> define("DELETE", 8); define("PURGE", 16);   define("ALLSTANDARDRIGHT", 31);
> define("READNOTE", 32);       define("UPDATENOTE", 64);   define("UNLOCK", 128);
> define("READ_ASSIGNED", 256); define("UPDATE_ASSIGNED", 512);
> define("READ_OWNED", 1024);   define("UPDATE_OWNED", 2048);
>
> // Management modes
> define("MANAGEMENT_UNITARY", 0); define("MANAGEMENT_GLOBAL", 1);
>
> // Mail send methods
> define("MAIL_MAIL", 0); define("MAIL_SMTP", 1); define("MAIL_SMTPSSL", 2);
> define("MAIL_SMTPTLS", 3); define("MAIL_SMTPOAUTH", 4);
> ```

Os direitos são um **bitmask**: um perfil combina permissões somando os bits
(`ALLSTANDARDRIGHT = 31 = READ|UPDATE|CREATE|DELETE|PURGE`). Direitos "assigned"/"owned"
existem para restringir visão/edição a itens atribuídos ou de propriedade do usuário
(base do modelo de service desk restrito).

## Sustenta
- [[Perfis e Direitos (RBAC)]]
- [[Tecnologias e requisitos de plataforma]]
- [[Modos de gestão (unitário vs global)]]
