---
title: EV-2-g3-019 · Aba Sistemas operacionais (campos e CLI)
aliases: [EV-2-g3-019]
tags: [evidence, tab, operating-system, cli, inventory]
type: evidence
status: confirmed
source: "SRC-002 · source/tabs/operating_systems.rst · Operating Systems"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g3-019 · Aba Sistemas operacionais (campos e CLI)

> [!quote] source/tabs/operating_systems.rst — "Operating Systems"
> Campos do SO, atualizáveis pelo inventário automático ou manualmente, com os comandos CLI de origem por sistema:
> - **Name**: Windows `Get-CimInstance Win32_OperatingSystem | Select Caption`; Linux `cat /etc/issue`; MAC "hard-coded in the GLPI agent code".
> - **Architecture** (32/64 bits, ARM): Windows `... Select OSArchitecture`; Linux/MAC `uname -m`.
> - **Kernel** (versão): Windows `... Select Version`; Linux/MAC `uname -r`.
> - **Product ID** (nº de série do OS): Windows `... Select SerialNumber`; Linux `/etc/sysconfig/rhn/systemid`; MAC nenhum.
> - **Company**: Windows `... Select organization`; Linux/MAC nenhum.
> - **Version** (ex.: 22.04.4 LTS, 22H2): atualizável pelo inventário; criável manualmente.
> - **Service pack**: pacote do OS (geralmente Windows).
> - **Edition**: antes indicava a edição; agora indicada no campo name.
> - **Serial number**: geralmente Windows — Client Product Key (chave genérica da edição, não a licença do OS).
> - **Owner** (dono da licença): Windows `... Select registereduser`; Linux/MAC nenhum.
> - **Host ID**: geralmente Linux (`hostid`), para associar a licenças de software.

## Sustenta
- [[Aba Sistema Operacional (ativos)]]
- [[Campos do Sistema Operacional (ativo)]]
- [[Provenância dos campos de SO (comandos CLI por sistema)]]
