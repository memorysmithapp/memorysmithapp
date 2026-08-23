---
title: Import e Export de regras, dicionários e formulários (XML)
aliases: [Rules import/export, Portabilidade de configuração]
tags: [regras, dicionarios, formularios, import, export, xml, migracao, doc]
type: integration
status: confirmed
source:
  - "[[EV-2-e2-007 · Motor de regras - usos e comportamentos|EV-2-e2-007]]"
  - "[[EV-2-e2-013 · Dicionários de dados - conceito e funcionamento|EV-2-e2-013]]"
  - "[[EV-2-e2-016 · Formulários - visibilidade, catálogo, controle de acesso e item a criar|EV-2-e2-016]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI permite **exportar, importar e duplicar** configurações administrativas para portar entre instâncias (tipicamente pré-produção → produção).

## Regras e dicionários
- Export/import/duplicação disponíveis para **todas as regras** e para **dicionários**.
- Operações globais (página principal) ou em lote via **ações massivas** nos resultados de busca.
- Formato **XML**.

## Formulários
- Exportação/importação de **formulários** entre instâncias (dev → produção) via ações massivas (Export) e botão **Import Forms**.
- Import com **reconciliação de campos** (Resolve issues): se faltam valores (entidade, usuário, grupo…), o GLPI oferece selecionar um valor existente ou criar um novo por campo em conflito.

> [!note] Ponte doc×código
> Relaciona-se com [[Sistema de Plugins (Hooks)]] (injetor de CSV citado nos dicionários) e com a operação de [[Configuração e Instalação]].
