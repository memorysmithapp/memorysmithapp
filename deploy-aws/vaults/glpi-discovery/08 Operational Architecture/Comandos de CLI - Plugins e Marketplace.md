---
title: "Comandos de CLI - Plugins e Marketplace"
aliases: [plugin:install, plugin:activate, marketplace:download]
tags: [cli, plugins, marketplace, comandos, operacional]
type: process
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-005 · Referência da linha de comando bin-console (cli.rst)|EV-2-g1-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Família de comandos `bin/console` para gerenciar **plugins** e interagir com o **marketplace** do GLPI por linha de comando (alternativa à interface web). Ver [[Sistema de Plugins (Hooks)]], [[Plugins e Marketplace]] e [[Interface de Linha de Comando (bin-console)]].

## Plugins (instalados)

| Comando (aliases) | Descrição | Argumentos / Opções |
|-------------------|-----------|---------------------|
| `glpi:plugin:install` (`plugin:install`) | Executa o script de instalação de plugin(s) | arg `directory`; `--all`/`-a`, `--param`/`-p` (array, ex. `-p foo=bar`), `--username`/`-u` (obrig.), `--force`/`-f` |
| `glpi:plugin:activate` (`plugin:activate`) | Ativa plugin(s) | arg `directory`; `--all`/`-a` |
| `glpi:plugin:deactivate` (`plugin:deactivate`) | Desativa plugin(s) | arg `directory`; `--all`/`-a` |

> [!example] Uso
> `glpi:plugin:install -p foo=bar -p force myplugin`
> O `--username` é usado durante o script de instalação, entre outras coisas para definir os direitos de administrador do plugin.

## Marketplace

| Comando (aliases) | Descrição | Argumentos / Opções |
|-------------------|-----------|---------------------|
| `glpi:marketplace:download` (`marketplace:download`) | Baixa plugin(s) do marketplace | arg `plugins` (chave, array, obrig.); `--force`/`-f` |
| `glpi:marketplace:info` (`marketplace:info`) | Obtém informações de um plugin | arg `plugin` (chave) |
| `glpi:marketplace:search` (`marketplace:search`) | Busca no marketplace | arg `term` (opcional) |

Ligações: [[Comandos de CLI - Migração de Dados]] (migração de plugins para o core) · [[Interface de Linha de Comando (bin-console)]]
