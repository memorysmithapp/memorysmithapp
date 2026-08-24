---
title: Campos comuns do GLPI (índice)
aliases: [Common fields, Campos comuns, Dicionário de campos comuns]
tags: [campos-comuns, indice, dicionario, data]
type: entity
status: confirmed
maturity: evergreen
reviewed: false
source:
  - "[[EV-2-g4-001 · Campos de identificação de inventário (série, UUID, nº inventário, fonte)|EV-2-g4-001]]"
  - "[[EV-2-g4-002 · Campos de modelo, fabricante e tipo de ativo|EV-2-g4-002]]"
  - "[[EV-2-g4-003 · Campos de rede e usuário alternativo do inventário|EV-2-g4-003]]"
  - "[[EV-2-g4-004 · Campos de atores (usuário, grupo, grupo e técnico responsáveis)|EV-2-g4-004]]"
  - "[[EV-2-g4-005 · Campos de localização e posição em datacenter|EV-2-g4-005]]"
  - "[[EV-2-g4-006 · Campos descritivos (comentários, cor, imagens, referência)|EV-2-g4-006]]"
  - "[[EV-2-g4-007 · Campo Status de itens|EV-2-g4-007]]"
  - "[[EV-2-g4-008 · Campo Tipo de gestão (unitária vs global)|EV-2-g4-008]]"
  - "[[EV-2-g4-009 · Campos de estoque e consumíveis (limite de alerta, estoque-alvo, tipo de cartucho)|EV-2-g4-009]]"
  - "[[EV-2-g4-010 · Credenciais SNMP e sysDescr|EV-2-g4-010]]"
  - "[[EV-2-g4-011 · Campo Portas sem redação na documentação|EV-2-g4-011]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

# Campos comuns do GLPI (índice)

Dicionário dos **campos comuns** (*common fields*) — atributos reutilizados de forma idêntica nos formulários de praticamente todos os objetos do GLPI (computadores, impressoras, periféricos, monitores, etc.). A documentação oficial os agrupa num diretório dedicado justamente porque a semântica não muda de um tipo de ativo para outro. Muitos são **dropdowns** customizáveis (ver [[Dropdown (lista suspensa customizável)]]) e integram o formulário-base descrito em [[Modelo de Ativos (padrão comum)]] e em [[Campos comuns de um ativo (formulário)]].

> [!note] Origem do valor
> Um traço recorrente destes campos é a **origem do dado**: uns são preenchidos automaticamente pelo [[Fluxo de inventário nativo]] (série, UUID, fabricante, modelo, usuário, usuário alternativo, sysDescr), outros são estritamente manuais (número de inventário, comentários, referência) e vários aceitam ambos, às vezes com **bloqueio (lock)** para impedir sobrescrita pelo inventário.

## Índice de campos

### Identificação / inventário
- [[Identificadores de um ativo (número de série e número de inventário)]]
- [[UUID (identificador da placa-mãe)]]
- [[Fonte de atualização (update source)]]

### Classificação de hardware
- [[Modelo de ativo (model)]]
- [[Fabricante (manufacturer)]]
- [[Tipo de ativo (asset type)]]

### Rede e inventário do usuário
- [[Rede (campo de ativo)]]
- [[Usuário alternativo do inventário (alternate username e número)]]
- [[Credenciais SNMP]]
- [[sysDescr (descrição SNMP)]]
- Portas — ver [[INV-2-g4-001 · Campo Portas de ativo não documentado (ports.rst pendente)]]

### Atores associados
- [[Usuário (campo user do ativo)]]
- [[Grupo (campo de ativo)]]
- [[Grupo responsável (group in charge)]]
- [[Técnico responsável (technician in charge)]]

### Localização física
- [[Localização (location)]]
- [[Posição em datacenter (data center position)]]

### Descritivos
- [[Campos descritivos comuns (comentários, cor)]]
- [[Imagens (pictures)]]
- [[Referência (reference)]]

### Estado e gestão
- [[Status de itens (campo comum)]]
- [[Tipo de gestão (unitária vs global)]]

### Estoque e consumíveis
- [[Limite de alerta (alert threshold)]]
- [[Estoque-alvo (stock target)]]
- [[Tipo de cartucho (cartridge type)]]

## Pontes doc × código
- [[Modelo de Ativos (padrão comum)]] — formulário-base que consome estes campos
- [[Infocom (dados financeiros do ativo)]] — dados financeiros complementares na ficha de um ativo
- [[Rede (portas, IP, VLAN)]] — modelagem de rede/portas (código)
- [[Status de itens (visão específica)]] — visão do campo Status
- [[Fornecedores e Contatos]] — relacionado a Fabricante
- [[Usuários e Grupos]] — modelo de atores por trás de user/group/técnico
