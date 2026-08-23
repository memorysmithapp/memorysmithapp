---
title: Aba Portas de Rede (ativos)
aliases: [Network ports tab, Aba Portas de Rede]
tags: [assets, tab, network, ports, vlan, computer]
type: component
status: confirmed
source: "[[EV-2-c3-004 · Aba Portas de Rede de um Computador|EV-2-c3-004]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Network ports** da ficha de um `Computer`, para gerenciar as portas de rede do equipamento. Uma porta representa a saída de uma interface de rede e é caracterizada por número e nome. É a visão de administrador do modelo descrito em [[Rede (portas, IP, VLAN)]].

> [!note] Tabela e opções de exibição
> A aba agrupa as portas numa tabela cujo cabeçalho traz o total de portas e um link de **opções de exibição**, que mostra/oculta seletivamente dados de rede (IP...), características por tipo, endereço MAC e VLANs.

A cada porta podem associar-se uma ou mais **VLANs** (nome, comentário opcional, número) e um ou mais **network name** (ver [[Aba Nome de Rede (Network Name)]]): com um único network name, ele é editável no próprio formulário da porta; com vários, só via o formulário do network name.

Os tipos de porta (físico, virtual, ponto a ponto) e suas variantes (Ethernet, WiFi, loop-back, alias, agregado) estão detalhados em [[Campos e tipos de Porta de Rede (ativo)]].

Adições/remoções ficam no histórico e podem vir do [[Inventário automático (processo)]].
