---
title: Aba Nome de Rede (Network Name)
aliases: [Network Name tab, Aba Nome de Rede, DNS name]
tags: [assets, tab, network, dns, fqdn, ip]
type: component
status: confirmed
source: "[[EV-2-c3-005 · Aba Nome de Rede (Network Name)|EV-2-c3-005]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Network Name**, que representa a identificação única de uma máquina do ponto de vista da Internet — o nome resolvido pelo DNS para um endereço IP. Um network name associa-se a uma [[Aba Portas de Rede (ativos)|porta de rede]] e integra o modelo [[Rede (portas, IP, VLAN)]].

> [!note] Nome (FQDN) e múltiplos IPs
> Um network name compõe-se de um nome correspondente ao rótulo **FQDN** e de um ou mais endereços **IP**. Como pode ter IPv4 e IPv6 simultaneamente, retorna vários IPs. O campo **IP network** serve apenas para consultar as redes IP disponíveis — não é guardado no network name, pois cada IP pode pertencer a várias redes.

> [!note] Aliases (CNAME)
> A seção **Network alias** lista/adiciona aliases da rede. O network name é tradicionalmente o usado pelo DNS na resolução reversa de um IP, enquanto os aliases correspondem ao `CNAME` do FQDN. O nome do alias deve ter um rótulo FQDN válido.

Ao inserir um network name, a validade do nome e de cada IP é verificada; elementos inválidos são rejeitados. Detalhamento dos campos em [[Campos de Nome de Rede (FQDN e IP)]].
