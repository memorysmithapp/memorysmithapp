---
title: OPCache e otimização de PHP
aliases: [OPCache, opcache blacklist]
tags: [opcache, php, performance, operacional, pdf, fontes]
type: infra
maturity: evergreen
reviewed: false
source: "[[EV-2-g1-001 · Sistema de cache do GLPI (cache.rst)|EV-2-g1-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

O **OPCache** é o cache de *bytecode* do próprio PHP: armazena arquivos PHP pré-compilados em memória, o que melhora o desempenho do GLPI. É distinto do [[Sistema de Cache do GLPI (operacional)]] (que é aplicacional). Para a maioria dos casos basta instalá-lo e habilitá-lo na instância PHP com a configuração padrão.

## Exclusão das fontes de PDF (instâncias muito usadas)

Em instâncias sob carga alta, pode ser vantajoso **não incluir os arquivos de fonte usados na geração de PDFs** no OPCache: eles ocupam muito espaço e o ganho de mantê-los em cache é mínimo.

Para excluí-los, informa-se o **caminho completo** dos arquivos de fonte em um **arquivo de blacklist** do opcache, cujo caminho é definido pela diretiva PHP `opcache.blacklist_filename`.

> [!example] Exemplo (Fedora)
> - Arquivo de blacklist: `/etc/php.d/opcache-glpi.blacklist`
> - Caminho a excluir (biblioteca TCPDF): `.../vendor/tecnickcom/tcpdf/fonts/`
>
> A localização do arquivo de configuração e o caminho das fontes devem ser adaptados ao sistema e ao tipo de instalação.

Ligações: [[Configuração Avançada do GLPI (visão geral)]] · [[Arquitetura de execução (request lifecycle)]] · [[Configuração e Instalação]]
