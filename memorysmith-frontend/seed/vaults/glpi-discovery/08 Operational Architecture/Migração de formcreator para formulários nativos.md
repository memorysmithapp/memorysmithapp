---
title: Migração de formcreator para formulários nativos
aliases: [Formcreator migration, migration:formcreator_plugin_to_core]
tags: [formularios, forms, migracao, cli, glpi11, doc]
type: infra
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-e2-015 · Formulários nativos - migração e tipos de pergunta|EV-2-e2-015]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

A partir do **GLPI 11**, os formulários são nativos e o plugin **formcreator** deixa de ser necessário. Formulários existentes devem ser **migrados**.

## Procedimento
- A migração deve ser feita **a partir da base do GLPI 10** — não é possível importar formulários de 10 para 11 depois.
- Durante a migração para o GLPI 11, o plugin **formcreator deve estar instalado**.
- Concluída a migração, rodar em **CLI**, na pasta do GLPI:

```
php bin/console migration:formcreator_plugin_to_core
```

Ver [[Formulários (módulo nativo)]].

> [!note] Ponte doc×código
> Relaciona-se com [[Sistema de Plugins (Hooks)]] e com [[Configuração e Instalação]] (comandos `bin/console`).
