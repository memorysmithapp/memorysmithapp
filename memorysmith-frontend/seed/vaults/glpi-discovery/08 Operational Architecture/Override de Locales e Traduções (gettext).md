---
title: Override de Locales e Traduções (gettext)
aliases: [override locales, traduções customizadas, gettext, _locales]
tags: [i18n, locales, traducoes, gettext, operacional, personalizacao]
type: process
status: confirmed
source: "[[EV-2-g1-003 · Override de traduções via gettext (override-locales.rst)|EV-2-g1-003]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O GLPI gerencia suas traduções com a ferramenta **gettext**. Um administrador pode **sobrescrever** as traduções padrão sem editar os arquivos `.po` originais — o método recomendado, pois edições diretas se perderiam na atualização do GLPI.

## Procedimento

1. **Criar o arquivo `.po` de override** em `files/_locales/core/` (para o núcleo) ou em `files/_locales/pluginkey/` (para um plugin, onde `pluginkey` é o nome da pasta do plugin). É possível ter vários arquivos, para gerenciar vários idiomas.
   - O diretório `_locales` pode estar em outro local se `local_define.php` definir a constante `GLPI_LOCAL_I18N_DIR`.
2. **Preencher as entradas**: `msgid` é a string de origem, `msgstr` é a tradução. As frases de origem corretas estão em `locales/glpi.pot`. Pode-se usar o editor **Poedit**.
3. **Compilar** o `.po` em `.mo` (formato legível pelo GLPI):
   ```sh
   $ cd files/_locales/core/
   $ msgfmt -o filename.mo filename.po
   ```
4. **Limpar o cache de traduções** (o GLPI usa cache para não carregar os MO a cada requisição — ver [[Sistema de Cache do GLPI (operacional)]]):
   - Em modo Debug: *Setup > General* → aba *Performance* → botão *Reset* na seção *Translation cache*.
   - Por linha de comando: `glpi:cache:clear` (executar **como o usuário do servidor web**).

> [!example] Exemplo de entrada
> ```po
> msgid "Login"
> msgstr "Login from local gettext"
> ```

Ligações: [[Comandos de CLI - Cache e Configuração]] · [[Configuração Avançada do GLPI (visão geral)]] · [[Personalização da Experiência do Usuário (capacidade)]] · [[Comandos de CLI - Regras, Ativos e Ferramentas]] (compilação de recursos)
