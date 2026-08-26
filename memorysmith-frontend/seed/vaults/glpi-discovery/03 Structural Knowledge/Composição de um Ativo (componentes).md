---
title: Composição de um Ativo (componentes)
aliases: [Componentes, Item_Devices, Devices]
tags: [concept, cmdb, componentes, dominio/ativos]
type: concept
maturity: evergreen
reviewed: false
source: "[[EV-1-016 · Composição do ativo via Item_Devices e itens filhos|EV-1-016]]"
author: CAD Discovery
created: 2026-07-10
---

# Composição de um Ativo (componentes)

Um ativo não é uma linha única: é um **agregado** de componentes e itens-filhos.

## Componentes de hardware
`Item_Devices` (relação) liga o ativo a **18 tipos de componente** (`Device*`):
processador, memória, disco rígido, placa de rede, placa de vídeo, placa-mãe, fonte,
bateria, controladora, drive, PCI, gabinete, firmware, sensor, simcard, câmera, placa de
som, genérico. Cada componente é um catálogo (o `Device*`) e sua **instância** no ativo
(`Item_Device*`) carrega dados específicos (nº de série, capacidade, frequência…).

## Outros itens-filhos
- **Sistema operacional** (`Item_OperatingSystem`), **discos lógicos** (`Item_Disk`).
- **Software instalado** (`Item_SoftwareVersion`) e **licenças** (`Item_SoftwareLicense`) —
  ver [[Software, Versões e Licenças]].
- **Rede** (`NetworkPort`, IPs) — ver [[Rede (portas, IP, VLAN)]].
- **VMs** (`ItemVirtualMachine`), **antivírus**, **gerência remota**, **periféricos
  conectados** (`Asset_PeripheralAsset`).
- **Documentos**, **contratos**, **Infocom** — pontes para outros domínios.

Ver o diagrama em [[Composição do ativo Computer (view)]].
