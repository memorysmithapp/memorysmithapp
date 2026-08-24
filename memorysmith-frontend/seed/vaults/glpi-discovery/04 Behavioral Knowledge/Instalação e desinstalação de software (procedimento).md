---
title: Instalação e desinstalação de software (procedimento)
aliases: [Install software, Uninstall software, Instalações]
tags: [software, installation, procedure, doc]
type: use-case
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-008 · Instalações e agrupamento de software (softwares.rst)|EV-2-c2-008]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Instalação e desinstalação de software (procedimento)

Procedimento de administrador para gerir instalações de [[Software (ativo, versões e licenças)]] em um computador. A instalação é sempre visualizada **através de uma versão**.

## Visualização
A instalação pode ser consultada em três lugares: no formulário do software (computadores com pelo menos uma versão instalada), no formulário da versão (computadores com essa versão) e no formulário do computador (versões instaladas, ordenadas por categoria).

## Instalar
- **Install** (acima da lista): instala manualmente uma versão, selecionando primeiro o software e depois a versão.
- Se houver licença associada, a **use version** da licença é selecionada automaticamente.
- A coluna `license` só é preenchida quando a licença está afetada ao computador.

## Desinstalar
- Via **mass actions**: selecionar as versões e escolher **Suppress definitively**.
- Se uma licença estiver afetada ao computador, ela **permanece afetada**, mas sua use version é apagada.

## Licenças afetadas mas não instaladas
- Exibidas após a lista de versões instaladas; é possível adicionar nova licença ao computador.
- Mass action **Install** instala uma use version das licenças selecionadas.

> [!note] A exibição inicial das categorias depende das [[Campos das Preferências do Usuário|preferências do usuário]].
