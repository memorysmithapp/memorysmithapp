---
title: EV-2-d2-002 · Clusters (clusters.rst)
aliases: [clusters.rst, Clusters]
tags: [evidence, management, cluster, doc]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/management/clusters.rst · Clusters"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-d2-002 · Clusters (clusters.rst)

Evidência da documentação sobre o objeto **Cluster** no módulo Management.

> [!quote] clusters.rst · introdução
> "A GLPI cluster is a grouping of several assets, which can be computers or network equipments." Nota: "GLPI clusters are taken into account when performing an impact analysis." (há um `.. todo::` no doc indicando link pendente para a representação de análise de impacto).

> [!quote] clusters.rst · "Description of specific fields"
> - **UUID**: identificador único do cluster.
> - **Version**: no caso de um cluster de software, pode-se informar o número da versão.
> - **Update Source**: como os dados do cluster foram atualizados.

> [!quote] clusters.rst · "The different tabs"
> - **Elements**: lista os elementos (ativos) do cluster e permite adicionar novos ativos ao cluster.
> - **Network ports**: lista as interfaces de rede do cluster e permite criar novas. Interfaces possíveis: Ethernet port; WiFi port; FiberChannel port; Port aggregate; Port alias; Dial up line connection; Local loop-back.
> - Inclui abas comuns: Contracts, Documents, Tickets, Problems, Changes, Historical e "all".

Capturas no doc: `images/clusters.png`, `images/elements-clusters.png`, `images/networks-clusters.png`.

## Sustenta
- [[Cluster (agrupamento de ativos)]]
- [[Campos específicos de Cluster]]
