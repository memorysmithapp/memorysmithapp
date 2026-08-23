---
title: EV-2-c3-004 · Aba Portas de Rede de um Computador
aliases: [EV-2-c3-004]
tags: [evidence, doc, assets, network, ports, vlan, computer]
type: evidence
status: confirmed
source: "SRC-002 · modules/assets/tabs/network-ports.rst · Network ports"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/network-ports.rst — "Network ports"
> A aba `Network ports`, visível numa entrada `Computer`, permite gerenciar as portas de rede associadas a um computador. Uma porta de rede representa a saída de uma interface de rede num dado hardware; é caracterizada por um número e um nome.
>
> - É possível associar a uma porta uma ou mais **VLANs**, definidas por nome, comentário opcional e número de VLAN.
> - Um ou mais **network name** podem ser associados a cada porta de rede (na aba `Network name`). Quando a porta tem apenas um network name, ele é exibido no próprio formulário da porta e pode ser editado diretamente; com vários nomes, só é possível editá-los via o formulário do network name.
> - Tipos de porta: **physical port** (ethernet, WiFi...), **Virtual network port** (loop-back local, alias, agregados...), **point to point** (rede comutada...).
> - A aba agrupa numa tabela as portas do equipamento. O cabeçalho traz o total de portas e um link de opções de exibição, para mostrar/ocultar seletivamente dados de rede (IP...), características da porta conforme o tipo, endereço MAC, VLANs...
> - **Portas Ethernet:** caracterizadas por tipo (par trançado, fibra ótica mono/multi-modo...), taxa de transferência (10Mb, 100Mb, 1Gb, 10Gb...) e endereço MAC. Pode-se associar uma placa de rede e uma tomada de rede (network plug). Conexões Ethernet ligam duas portas Ethernet (uma porta livre em cada equipamento); em geral ligam uma porta de computador/periférico/impressora a uma porta de equipamento de rede (hub, switch).
> - **Portas WiFi:** caracterizadas pelo modo da placa (ad-hoc, ponto de acesso, repetidor...), versão do protocolo WiFi (ab, g...) e endereço MAC. Pode-se associar placa de rede. Uma rede WiFi (com ESSID) tem tipo Infrastructure (com pontos de acesso e clientes) ou Ad-hoc (entre sistemas similares sem pontos de acesso).
> - **Loop-back local:** porta virtual usada para comunicação interna (localhost / 127.0.0.1); sem atributo específico.
> - **Alias de porta:** porta virtual que refina uma porta física (ex. `eth2.50` para VLAN 50 taggeada em `eth2`); contém a porta base e um MAC. Ao mudar a porta de origem, o MAC da nova porta é atribuído ao alias.
> - **Agregado de porta:** porta virtual que agrupa várias portas físicas (bridges no Linux); contém as portas de origem e um MAC.
> - Toda exclusão ou adição de uma porta de rede é registrada no histórico do computador.
> - Com inventário nativo/terceiro, as informações de portas podem ser importadas e atualizadas automaticamente.
>
> Capturas de tela no doc: `ports.png`, `ports_vlan.png`, `ports_network_name.png`.

## Sustenta
- [[Aba Portas de Rede (ativos)]]
- [[Campos e tipos de Porta de Rede (ativo)]]
