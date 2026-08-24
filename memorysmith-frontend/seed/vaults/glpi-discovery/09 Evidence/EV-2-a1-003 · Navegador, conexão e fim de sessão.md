---
title: EV-2-a1-003 · Navegador, conexão e fim de sessão
aliases: [EV-2-a1-003]
tags: [evidence, doc, login, browser, session, interface]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · source/first-steps/general.rst · General (Choose a web browser / How to connect / End your session)"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-a1-003 · Navegador, conexão e fim de sessão

> [!quote] source/first-steps/general.rst — Choose a web browser
> "GLPI requires the use of a web browser. Optimal functioning of the application is obtained by using a modern browser compliant with web standards." Navegadores suportados: **Edge**, **Firefox** (incluindo as 2 últimas versões ESR), **Chrome**. GLPI também funciona em mobile, geralmente compatível com as versões móveis dos navegadores suportados.

> [!quote] source/first-steps/general.rst — How to connect
> "Open your browser and go to the GLPI homepage (`https://{glpi_address}/`). Access to the full functionality of the application requires authentication."

Um usuário **não autenticado** pode, se o GLPI estiver configurado para permitir, acessar certas funções: abrir um ticket, consultar ativos, ver a FAQ, etc.

Conforme o perfil do usuário autenticado, é exibida a **interface padrão** (`standard_interface`) ou a **interface simplificada** (`simplified_interface`).

> [!quote] source/first-steps/general.rst — End your session
> "To log out, click the logout button in the top right of the screen. Once logged out, you will be redirected to the login page." (captura de tela: `images/logout.png`)

## Sustenta
- [[Acesso e Login no GLPI (fluxo)]]
