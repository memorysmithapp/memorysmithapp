---
title: EV-2-c3-005 · Aba Nome de Rede (Network Name)
aliases: [EV-2-c3-005]
tags: [evidence, doc, assets, network, dns, fqdn, ip]
type: evidence
status: confirmed
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/assets/tabs/network_name.rst · Network Name"
author: CAD Discovery (doc)
created: 2026-07-12
---

> [!quote] modules/assets/tabs/network_name.rst — "Network Name"
> Um network name é a identificação única de uma máquina do ponto de vista da Internet. Geralmente um dispositivo é identificado por um ou mais nomes na rede; o servidor DNS resolve esse nome para um endereço IP.
>
> - Se IPv4 e IPv6 são usados, o nome retorna dois endereços IP (um IPv4, outro IPv6) — por isso um network name pode ter vários endereços IP.
> - Um network name é composto por um nome que corresponde ao rótulo **FQDN** e por um ou mais endereços IP.
> - O campo **IP network** aparece para recuperar informações sobre as diferentes redes IP disponíveis; essa informação não é guardada no network name porque ele pode ter vários IPs e cada um pode pertencer a várias redes IP.
> - Ao inserir um network name, a validade do nome e de cada endereço IP é verificada; se algum não é válido, é rejeitado.
> - Para adicionar um IP: clicar em **+ Add** à frente dos campos de entrada de IP. Para remover: apagar o conteúdo do campo IP.
> - **Network alias:** exibe a lista de aliases desta rede e permite adicionar novos. Tradicionalmente o network name é o usado pelo DNS para resolução reversa de um IP, enquanto os aliases correspondem ao `CNAME` do nome FQDN. O nome do alias deve ter um rótulo FQDN válido.
>
> Captura de tela no doc: `images/network_name.png`.

## Sustenta
- [[Aba Nome de Rede (Network Name)]]
- [[Campos de Nome de Rede (FQDN e IP)]]
