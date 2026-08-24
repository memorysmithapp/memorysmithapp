---
title: Configuração da API REST
aliases: [API tab, API config, apirest]
tags: [configuracao-geral, api, rest, integracao, operacao]
type: capability
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-014 · Configuração da API REST|EV-2-f1-014]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **API** (Setup > General): parâmetros de configuração e limitações de acesso da API — ver código [[API REST e GraphQL]].

## Parâmetros
- **URL da API**: deve corresponder à URL do GLPI com `/apirest.php` ao final. Há link para a documentação.
- **Authentication** (dois métodos, habilitáveis individualmente):
  - **Credentials**: login e senha do usuário.
  - **External token**: token pessoal, visível apenas na página pessoal do usuário — ver [[Campos das Preferências do Usuário]].
- **API clients**: cada cliente tem **nome**, **método de logging** (historical, logs ou none) e ao menos um **application token**; é possível configurar uma **faixa de IP** para limitar o acesso.

> [!note]
> Habilitar a API é pré-requisito de integrações externas — ver [[INV-1-003 · Comportamento de produção via plugins fora do repo]] e [[Plugins e Marketplace]].
