---
title: Dicionários de dados (administração)
aliases: [Dictionaries, Dicionários, Dictionnaries]
tags: [dicionarios, regras, normalizacao, doc]
type: capability
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-e2-013 · Dicionários de dados - conceito e funcionamento|EV-2-e2-013]]"
  - "[[EV-2-e2-014 · Dicionários globais e de drop-downs|EV-2-e2-014]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

**Dicionários** permitem modificar dados já existentes ou novos no GLPI para **agrupar/normalizar dados redundantes**. São baseados no [[Motor de Regras na Administração (gestão de regras)|motor de regras]] e disponíveis para alguns tipos de item (software, fornecedores, drop-downs). Modificam valores inseridos manualmente ou automaticamente (inventário, plugins como injetor de CSV).

## Dicionários disponíveis
**Globais:**
- **Software**: normaliza name/version/manufacturer (mescla softwares equivalentes; adiciona fabricante ausente; pode **redirecionar** criação para uma entidade). A ação *Add regexp result* numa versão só vale ao importar do inventário.
- **Manufacturer**: agrupa variações de nomes de fabricante.
- **Printers**: modifica info por fabricante/nome; rejeita import, agrupa, atribui fabricante ou força tipo de gestão (global/unitário).

**Drop-downs** (relacionados a inventário):
- **Models** (critérios: fabricante e modelo);
- **Types** (critério: tipo do item);
- **Operating systems** (critério: SO, service pack ou versão).

## Operação
Ver [[Processamento de dados por um dicionário (fluxo)]]. Reexecução via botão **Replay the dictionary rules** ou pelo script CLI `compute_dictionnary.php`. Import/export/duplicação em **XML** — ver [[Import e Export de regras, dicionários e formulários (XML)]].

> [!note] Ponte doc×código
> Corresponde, na perspectiva de produto, à nota E1 [[Dicionário de dados (dictionary)]]. Relaciona-se com [[Dropdown (lista suspensa customizável)]] e [[Software, Versões e Licenças]].
