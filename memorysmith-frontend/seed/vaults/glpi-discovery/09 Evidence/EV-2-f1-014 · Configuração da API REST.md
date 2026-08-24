---
title: EV-2-f1-014 · Configuração da API REST
aliases: [EV-2-f1-014]
tags: [evidence, api, rest, configuracao-geral]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/general/api.rst · API"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/api.rst — "API"
> "API configuration parameters and access limitations."
> - URL da API: deve corresponder à URL do GLPI com `/apirest.php` ao final. Há link para a documentação da API.
> - **Authentication** (dois métodos habilitáveis individualmente): **Credentials** (login e senha do usuário) e **External token** (token pessoal, visível apenas na página pessoal do usuário).
> - **API clients**: gerenciáveis nesta aba; cada cliente tem nome, método de logging (historical, logs ou none) e ao menos um application token; pode-se configurar uma **faixa de IP** para limitar acesso.

## Sustenta
- [[Configuração da API REST]]
