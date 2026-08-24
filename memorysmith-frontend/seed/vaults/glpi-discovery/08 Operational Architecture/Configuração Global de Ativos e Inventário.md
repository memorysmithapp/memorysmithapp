---
title: Configuração Global de Ativos e Inventário
aliases: [Assets configuration, Config global de ativos]
tags: [configuracao-geral, ativos, inventario, operacao]
type: capability
status: confirmed
maturity: evergreen
reviewed: false
source: "[[EV-2-f1-007 · Configuração global de ativos e inventário|EV-2-f1-007]]"
author: CAD Discovery (doc)
created: 2026-07-12
---

Aba **Assets** (Setup > General) com parâmetros globais para o inventário e a gestão de ativos — ver [[Gestão de Ativos e Configuração (SACM)]].

## Parâmetros de ativos
- **Enable the financial and administrative information by default**: aplica [[Infocom (dados financeiros do ativo)|infocom]] a todos os objetos.
- **Software category deleted by the dictionary rules**: categoria para softwares deletados por regras de dicionário (padrão: FUSION) — ver [[Dicionário de dados (dictionary)]].
- **End of fiscal year**: usado na seção Management / [[Gestão Financeira de TI]].
- **Automatic fields (marcados por \*)**: campos gerados a partir de template, incrementáveis por entidade ou globalmente — ver [[Preenchimento automático e incremento em templates]].
- **Restrict monitor/device/phone/printer management**: ao criar manualmente, o usuário escolhe **gestão unitária ou global**; a global importa o elemento uma só vez, a unitária tantas vezes quanto usado; é possível restringir o tipo por equipamento — ver [[Gestão global vs unitária de itens]].

## Atualização automática de elementos ligados aos computadores
Interfaceamento com ferramenta de inventário (nativo ou plugin) — ver [[Fluxo de inventário nativo]], [[Agente de Inventário (protocolo)]].
- **When connecting or updating**: ao conectar dispositivo unitário a um computador, recuperar informações do computador (ex.: User).
- **When disconnecting**: ao desconectar, remover certos dados (ex.: User). Ex.: monitor conectado assume status "Production"; ao desconectar, "Available".
