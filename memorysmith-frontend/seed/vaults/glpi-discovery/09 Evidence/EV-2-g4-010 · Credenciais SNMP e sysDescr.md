---
title: EV-2-g4-010 · Credenciais SNMP e sysDescr
aliases: [EV-2-g4-010]
tags: [evidence, campos-comuns, snmp, inventario, rede]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-002 · tabs/common_fields/SNMP_credentials.rst · SNMP Credentials; tabs/common_fields/sysdescr.rst · Sysdescr"
author: CAD Discovery (doc)
created: 2026-07-12
---

# EV-2-g4-010 · SNMP Credentials e sysDescr

> [!quote] SNMP Credentials (`SNMP_credentials.rst`)
> "SNMP Credentials are parameters used to enable GLPI to interact with network devices through the SNMP (Simple Network Management Protocol). They are used to automatically retrieve information about devices for inventory." Papéis: identificação de dispositivo (nome, firmware, IP), coleta de dados (status de portas, MAC/IP, modelo/fabricante/versão de software) e inventário automatizado.
>
> Principais parâmetros: **SNMP Community Name** (chave compartilhada; padrão **public** read-only, **private** read/write); **SNMP Version** (v1 básica sem segurança, v2c mais performática sem segurança forte, v3 com autenticação e criptografia — recomendada); **OID** (objeto a consultar, ex. `sysDescr`, `sysName`, `interfaces`); **Device IP Address or FQDN**. Configuração em **Administration > Inventory > SNMP Credentials**; requer suporte ao agente ativado.

> [!quote] Sysdescr (`sysdescr.rst`)
> "sysDescr is a key element of the SNMP protocol ... A standard object in the Simple Network Management Protocol (SNMP), it provides a basic textual description of a network device or piece of IT equipment, such as routers, switches, printers ... This field is fed by the SNMP inventory."

## Sustenta
- [[Credenciais SNMP]]
- [[sysDescr (descrição SNMP)]]
