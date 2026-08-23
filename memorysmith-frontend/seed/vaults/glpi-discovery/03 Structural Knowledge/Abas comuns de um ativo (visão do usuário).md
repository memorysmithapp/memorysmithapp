---
title: Abas comuns de um ativo (visão do usuário)
aliases: [Abas de ativo, Tabs de ativo]
tags: [assets, tabs, ui, structural]
type: component
status: confirmed
source:
  - "[[EV-2-c1-003 · Formulário e abas de Computador|EV-2-c1-003]]"
  - "[[EV-2-c1-004 · Formulário de Monitor e gestão unitária vs global|EV-2-c1-004]]"
  - "[[EV-2-c1-005 · Formulário e abas de Periférico|EV-2-c1-005]]"
  - "[[EV-2-c1-006 · Formulário e abas de Telefone|EV-2-c1-006]]"
  - "[[EV-2-c1-007 · Formulário e abas de Impressora|EV-2-c1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Abas comuns de um ativo (visão do usuário)

O formulário de um ativo divide as informações em **abas**. A maioria dos tipos de ativo de hardware (computador, monitor, periférico, telefone, impressora) compartilha um repertório comum de abas, além de campos básicos.

## Repertório de abas
- **Impact Analysis** — diagrama de infraestrutura com dependências e impactos em caso de perda do equipamento; pode ser salvo e exportado.
- **Operating systems** — dados do SO ([[Campos da aba Sistemas operacionais]]).
- **Components** — [[Componentes de hardware de um ativo (lista)]].
- **Software** — softwares trazidos pelo inventário ou adicionados manualmente. Ver [[Software, Versões e Licenças]].
- **Connections** — hardware conectado à máquina (Device, Monitor, Phone, Printers); atualizável por inventário ou manualmente.
- **Network Ports** — [[Campos da aba Portas de rede]]. Ver [[Rede (portas, IP, VLAN)]].
- **Sockets** — tomadas físicas (Ethernet, USB, HDMI...); não retornado pelo inventário automático (entrada manual); liga hardware por cabos.
- **Volumes** — volumes e partições (aplicável a computador, telefone, impressora).
- **Remote management** — software de acesso remoto (TeamViewer, AnyDesk...).
- **Management** — informações financeiras e administrativas. Ver [[Infocom (dados financeiros do ativo)]] · [[Gestão Financeira de TI]].
- **Contracts** — [[Gestão de Contratos (processo)]].
- **Documents** — anexos ([[Documentos (Document)]]).
- **Knowledge Base** — artigos relacionados ([[Base de Conhecimento (KnowbaseItem)]]).
- **Tickets / Problems / Changes** — objetos ITIL ligados ([[Ticket]], [[Problem]], [[Change]]).
- **Projects** — projetos ligados (periférico, impressora).
- **Links** — links externos (envio do arquivo do objeto para uma URL, geração de arquivo RDP...).
- **Locks** — [[Bloqueio de campos manuais no inventário (locks)]].
- **Notes** — texto enriquecido + anexo. Ver E1 [[Notas em GLPI (pessoal, pública, global, privada)]].
- **Reservations** — [[Reserva de Ativos e Documentos (processos)]]; por padrão o equipamento não é reservável, é preciso autorizar manualmente.
- **Domains / Appliances / Databases / Certificates / Virtualization / Antiviruses** — vínculos e dados adicionais (variam por tipo).
- **Import information** — dados de importação governados pelas *rules for import and link equipments* (Administration > Rules). Ver [[Motor de Regras de Negócio (capacidade)]] · [[Tipos de Regra]].
- **Historical** — todas as ações realizadas sobre o objeto. Ver [[Ciclo de vida de um item (add-update-delete)]].
- **All** — visão unificada de todas as abas.

> [!note] Nem todo tipo tem todas as abas — a composição varia (ver as notas de campos de cada tipo).
</content>
