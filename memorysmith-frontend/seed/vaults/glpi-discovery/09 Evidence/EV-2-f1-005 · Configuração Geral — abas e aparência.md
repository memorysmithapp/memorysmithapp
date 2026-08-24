---
title: EV-2-f1-005 · Configuração Geral — abas e aparência
aliases: [EV-2-f1-005]
tags: [evidence, configuracao-geral, aparencia, setup]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/general/index.rst + general/general_configuration.rst · General configuration"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/configuration/general/index.rst — "General configuration"
> "GLPI general configuration allow global GLPI configuration. Some of the parameters can be changed by users in their session."
> Abas (toctree): general_configuration, default_values, assets, assistance, management, logs_purge, system, security, performances, api, impact_analysis, sql_replicas, glpi_network.

> [!quote] modules/configuration/general/general_configuration.rst — "General configuration"
> Aba que customiza a aparência principal da aplicação. Campos:
> - **URL of the application**: usada em links, notificações e API; definida na instalação.
> - **Text in the login box**: texto exibido no topo do bloco de login.
> - **Allow FAQ anonymous access**: acesso à FAQ sem login (exibe link abaixo do box de login).
> - **Default search results limit**: máximo de resultados exibidos por vez nas buscas.
> - **Default characters limit**: máximo de caracteres visíveis nos resultados (trunca conteúdo).
> - **Default url length limit**: idem para URLs.
> - **Default decimals limit**: número de decimais para valores.
> - **Translation of dropdowns / of reminders / Knowledge base translation**: habilitam aba de tradução.
> - **Simplified/Standard interface help link**: links de ajuda por interface.
> - **Page size for dropdown**: elementos por scroll no dropdown.
> - **Don't show search engine in dropdowns if the number of items is less than**: oculta busca em dropdown pequeno.
> - **Items seen**; **Global search**: habilita busca global (campo de busca no topo da interface).

## Sustenta
- [[Configuração Geral do GLPI (Setup - General)]]
- [[Configuração de Aparência e Parâmetros Globais]]
