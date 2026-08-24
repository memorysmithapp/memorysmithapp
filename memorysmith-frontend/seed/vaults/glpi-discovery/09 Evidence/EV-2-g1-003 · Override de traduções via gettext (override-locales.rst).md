---
title: EV-2-g1-003 · Override de traduções via gettext (override-locales.rst)
aliases: [EV-2-g1-003]
tags: [evidence, locales, traducoes, gettext, i18n, operacional]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · advanced/override-locales.rst · Override GLPI locales"
author: CAD Discovery (doc)
created: 2026-07-12
---

## Trecho / Paráfrase

> [!quote] advanced/override-locales.rst — "Override GLPI locales"
> O GLPI usa a ferramenta **gettext** para gerenciar suas traduções, e é possível sobrescrever o padrão. Esse é o método preferido em vez de editar os arquivos `.po` originais (que se perderiam na atualização).
>
> Cria-se um arquivo `filename.po` no diretório `files/_locales/core/`. Também há overrides para plugins em `files/_locales/pluginkey/` (onde `pluginkey` é o nome da pasta do plugin). Dependendo da configuração, o diretório `_locales` pode estar em outro lugar (se `local_define.php` definir a constante `GLPI_LOCAL_I18N_DIR`). Pode haver múltiplos arquivos, para vários idiomas.
>
> O arquivo deve ser um gettext válido (pode ser criado com o **Poedit**). `msgid` é a string de origem e `msgstr` a tradução; as frases de origem corretas estão em `locales/glpi.pot`. Depois, compila-se o `.po` em `.mo` legível pelo GLPI: `msgfmt -o filename.mo filename.po` (dentro de `files/_locales/core/`).
>
> Por fim, como o GLPI usa cache para evitar carregar os arquivos MO a cada requisição, é preciso **limpar o cache** para ver as mudanças. Em modo Debug: *Setup > General*, aba *Performance*, botão *Reset* na seção *Translation cache*. Com acesso por linha de comando, usa-se `glpi:cache:clear` (executando o comando como o usuário do servidor web).

## Sustenta

- [[Override de Locales e Traduções (gettext)]]
