---
title: Dropdowns de Internet e rede (IP, nomes de rede, domínios)
aliases: [Internet dropdowns, IP networks, Network names, Internet domains, FQDN]
tags: [dropdown, internet, ip-network, network-name, vlan, fqdn]
type: component
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f2-009 · Dropdowns de internet redes IP e nomes de rede|EV-2-f2-009]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Dropdowns de Internet e rede (IP, nomes de rede, domínios)

Modelagem do protocolo IP no GLPI. Categoria de [[Catálogo de tipos de dropdown (configuração)]]; visão de configuração de [[Rede (portas, IP, VLAN)]].

## Modelo IP
O protocolo IP é representado como **endereços IP, redes IP e FQDN**. Um dispositivo conecta-se por **portas de rede**; a uma porta associam-se um ou mais **Network Names**; um Network Name pode pertencer a um Internet Domain, ter vários IPs e aliases. IPv4 é tratado como subconjunto de IPv6 (IPv4-mapped). O GLPI mantém representação binária (interna) e textual (exibição/entrada). Máscaras IPv6 na forma de prefixo de sub-rede.

## IP networks
Definem a topologia; agrupam endereços IP conforme o plano de endereçamento. Podem ser **aninhadas**; a hierarquia é **implícita e não modificável manualmente** (deriva de endereços/máscaras). Compõem-se de endereço + máscara (gateway opcional); uma rede "addressable" é usada para roteamento interno. Abas: **VLAN**, **IP addresses** (ordenável por número IP ou tipo de equipamento). Ver [[Campos de rede IP e nome de rede]].

## Internet domains e Wi-Fi networks
- **Internet domains**: aba Network names (nomes de rede do domínio).
- **Wi-Fi networks**: seção marcada **"TO BE DONE"** na documentação (ver [[INV-2-f2-002 · Dropdown de Wi-Fi networks e network-name.rst não redigidos]]).

## Network names
Identificação única de uma máquina do ponto de vista da Internet; o DNS o resolve a um IP (pode retornar um IPv4 e um IPv6). Compõe-se de um rótulo **FQDN** e um ou mais IPs. Validade do nome e de cada IP é verificada na entrada. Aba **Network alias**: aliases correspondem ao **CNAME** do FQDN, também exigindo rótulo FQDN válido.
