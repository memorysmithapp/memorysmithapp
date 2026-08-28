---
title: EV-2-f2-009 · Dropdowns de internet redes IP e nomes de rede
aliases: [EV-2-f2-009]
tags: [evidence, dropdown, internet, ip-network, network-name, fqdn]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · modules/configuration/dropdowns/internet.rst · modules/configuration/dropdowns/network-name.rst"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-f2-009 · Dropdowns de internet redes IP e nomes de rede

> [!quote] internet.rst — modelo do protocolo IP
> O protocolo IP é representado em várias formas: **endereços IP, redes IP, FQDN**. Um dispositivo conecta-se a uma rede por **portas de rede**; a uma porta associam-se um ou mais **Network Names**. Um Network Name pode pertencer a um Internet Domain, conter um ou mais endereços IP e ter vários aliases. Um endereço IP pertence a uma rede IP. Redes são IPv4 ou IPv6; o GLPI trata IPv4 como subconjunto de IPv6 (IPv4-mapped). Usa representação binária (interna, análise de relações) e textual (exibição/entrada). Máscaras IPv6 na forma de prefixo de sub-rede.

> [!quote] internet.rst — IP networks
> **IP networks** definem a topologia de rede, agrupando endereços IP conforme o plano de endereçamento. Podem ser **aninhadas**; a hierarquia depende de endereços/máscaras e identidades associadas (ex.: `192.168.1.0/255.255.255.0` é sub-rede de `192.168.0.0/255.255.254.0`) e é gerenciada implicitamente, **não modificável manualmente**. Uma rede compõe-se de ao menos endereço e máscara; gateway opcional. Uma rede é "addressable" se usada para roteamento interno. Abas: **VLAN** (VLANs associadas), **IP addresses** (ordenável por número IP ou por tipo de equipamento), histórico, all.

> [!quote] internet.rst — Internet domains e Wi-Fi networks
> **Internet domains**: aba Network names (lista os nomes de rede do domínio). **Wi-Fi networks**: "TO BE DONE" (não redigido).

> [!quote] internet.rst / network-name.rst — Network names
> Um **network name** é a identificação única de uma máquina do ponto de vista da Internet; o servidor DNS o resolve para um endereço IP (pode retornar um IPv4 e um IPv6, por isso pode ter vários IPs). Compõe-se de um nome (rótulo FQDN) e um ou mais endereços IP. O campo IP network aparece para recuperar informação das redes IP disponíveis (não guardado no network name pois pode ter vários IPs). Na entrada, a validade do nome e de cada IP é verificada; inválidos são rejeitados. Adicionar IP: botão *plus*; remover: apagar o conteúdo do campo. Aba **Network alias**: aliases (CNAME do FQDN; também exigem rótulo FQDN válido). O arquivo dedicado `network-name.rst` está marcado como "This page must be redacted" (a redigir).

## Sustenta
- [[Dropdowns de Internet e rede (IP, nomes de rede, domínios)]]
- [[Campos de rede IP e nome de rede]]
