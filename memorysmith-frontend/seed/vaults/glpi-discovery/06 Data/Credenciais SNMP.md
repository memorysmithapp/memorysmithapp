---
title: Credenciais SNMP
aliases: [SNMP Credentials, Credenciais SNMP, SNMP Community]
tags: [campos-comuns, snmp, inventario, rede, data]
type: field
maturity: evergreen
reviewed: false
source: "[[EV-2-g4-010 · Credenciais SNMP e sysDescr|EV-2-g4-010]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Credenciais SNMP

Parâmetros que permitem ao GLPI interagir com dispositivos de rede via **SNMP** (Simple Network Management Protocol) para **recuperar automaticamente** informações no inventário — identificação de dispositivo (nome, firmware, IP), coleta de dados (status de portas, MAC/IP, modelo/fabricante/versão de software) e enriquecimento automático do inventário.

Principais parâmetros:
- **SNMP Community Name:** chave compartilhada GLPI × dispositivo (padrão **public** read-only, **private** read/write).
- **SNMP Version:** **v1** (básica, sem segurança), **v2c** (mais performática, sem segurança forte), **v3** (autenticação + criptografia — recomendada; requer credenciais de usuário com chaves).
- **OID:** objeto a consultar (ex.: `sysDescr`, `sysName`, `interfaces`).
- **Device IP Address ou FQDN:** alvo da consulta.

Configuração em **Administration > Inventory > SNMP Credentials** (requer suporte ao agente ativado). Alimenta campos como [[sysDescr (descrição SNMP)]] e informações de [[Rede (portas, IP, VLAN)]]. Parte do [[Fluxo de inventário nativo]] / [[Agente de Inventário (protocolo)]].
