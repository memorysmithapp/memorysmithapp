---
title: EV-2-f3-010 · Instalação, atualização e remoção de plugins
aliases: [EV-2-f3-010]
tags: [evidence, plugin, marketplace, instalacao, glpi-network, hook]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/plugins.rst · Install and update plugins"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f3-010 · Instalação, atualização e remoção de plugins

> [!quote] plugins.rst · "Install and update plugins"
> Adição e manutenção de extensões (plugins) no GLPI. **Recomenda-se backup do banco antes de instalar/atualizar**. Na primeira visita a `Setup > Plugins`, pergunta-se se quer usar a UI do **marketplace** por padrão ou a lista de plugins mais antiga; pode-se alternar a qualquer momento. Se um plugin for instalado por ambos os métodos, a versão do marketplace é usada.

> [!quote] Marketplace
> Requer uma **chave de registro do GLPI Network** (gratuita em services.glpi-network.com se não houver assinatura paga); inserida em `Setup > General` na aba `GLPI Network`. Aba **Discovery**: lista todos os plugins (oficiais gratuitos/assinatura e comunitários); filtro por categoria e busca. Plugins com `GLPI NETWORK` exigem assinatura não gratuita e indicam o tier (`BASIC`, `STANDARD`, `ADVANCED`; cada tier pago inclui os inferiores).
> **Instalar**: botão à direita do plugin (ou erros explicando o impedimento); baixa a última versão compatível e instala. Plugins do marketplace ficam na pasta `marketplace` na raiz. Após instalar, o botão vira um toggle de habilitação (precisa clicar para ativar). Alguns exigem configuração específica (ícone de chave inglesa); o plugin aparece no módulo correspondente (support, management, tools, administration, setup).
> **Atualizar**: aba **Installed**; botão de atualização se houver versão nova (ou erros). É preciso re-habilitar após atualizar.

> [!quote] Gestão manual de plugins
> Principal forma de descobrir plugins: o **catálogo de plugins** (plugins.glpi-project.org). Baixar a versão compatível com sua versão do GLPI. Extrair para a pasta `plugins` no diretório do GLPI; a nova pasta deve ter o nome interno do plugin (minúsculas, sem espaços) e conter ao menos `hook.php` e `setup.php`. O GLPI detecta automaticamente e exibe na lista. Após instalar/atualizar, re-habilitar.

> [!quote] Desinstalação
> O botão *uninstall* não remove o código; o plugin continua na lista para reinstalar. Para remover permanentemente, apagar a pasta do plugin; depois surge uma ação **cleanup** que remove a referência do plugin do banco.

> [!quote] Plugins e atualização do GLPI
> Ao atualizar o GLPI, a execução dos plugins é **suspensa**, preservando o estado antes da atualização. É retomada automaticamente em atualizações de bugfix (ex.: 11.0.x → 11.0.y), mas manualmente em atualizações maiores/intermediárias (11.0.x → 11.1.y ou 12.0.z). Também se pode suspender todos os plugins (`Suspend execution of all plugins`) para diagnosticar anomalias e depois `Resume execution of all active plugins`.

## Sustenta
- [[Instalação e atualização de plugins (marketplace)]]
- [[Suspensão de plugins na atualização do GLPI]]
