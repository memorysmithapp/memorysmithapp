---
title: Equipamento de Rede (ativo)
aliases: [Network equipment, NetworkEquipment, Equipamento de rede]
tags: [assets, network, dcim, structural, doc]
type: component
maturity: evergreen
reviewed: false
source: "[[EV-2-c2-001 · Equipamentos de rede (network-equipments.rst)|EV-2-c2-001]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Equipamento de Rede (ativo)

Tipo de ativo do módulo **Assets** que representa o hardware que gerencia, transmite e roteia a rede entre outros equipamentos. Pode ser um **switch, hub Ethernet, roteador, firewall ou ponto de acesso WiFi**.

É a visão de administrador/usuário do conceito de rede já mapeado no código em [[Rede (portas, IP, VLAN)]], e um dos ativos gerenciados pela [[Gestão de Ativos e Configuração (SACM)]].

## Composição (abas do formulário)
- **Network device**: informações básicas ([[Campos do formulário de Equipamento de Rede]]).
- **Impact Analysis**: diagrama de dependências/impactos, salvável e exportável.
- **Operating systems**, **Software**, **Components**, **Lines**, **Volumes** — herdadas do padrão de ativos tipo computador (ver [[Composição de um Ativo (componentes)]]).
- **Network Ports**, **Network Name**, **Sockets** — conectividade ([[Campos da aba Portas de Rede (Network Ports)]]).
- Abas comuns: Management, Contracts, Documents, Knowledge Base, Tickets, Problems, Changes, Projects, Links, Notes, Reservations, Certificates, Locks, Domains, Appliances, Databases, Historical.

> [!note] Inventário automático e locks
> Se inventariado pelo GLPI Agent, exibe dados do agente (última coleta, tag, etc.). Campos editados manualmente ficam **travados** (locked) e não são sobrescritos no próximo upload de inventário — ver [[Inventário automático (processo)]]. Aba **Import information** governada pelas regras "Rules for import and link equipments".

## Relações
- Suporta [[Templates de itens (modelos)]].
- Sockets ligam o hardware a [[Cabo (ativo)]].
- Reservas desabilitadas por padrão (ver [[Reserva de Ativos e Documentos (processos)]]).
