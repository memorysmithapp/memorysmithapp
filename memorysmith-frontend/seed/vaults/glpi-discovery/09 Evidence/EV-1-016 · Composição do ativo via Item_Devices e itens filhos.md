---
title: EV-1-016 · Composição do ativo via Item_Devices e itens-filhos
aliases: [EV-1-016]
tags: [evidence, dominio/ativos, componentes]
type: evidence
status: confirmed
source: "SRC-001 · src/Item_Devices.php L50 · src/Computer.php L80–108 (getCloneRelations) · src/Device*.php (18 tipos)"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-016 · Composição do ativo via Item_Devices e itens-filhos

> [!quote] `src/Computer.php::getCloneRelations()` (relações que compõem um Computer)
> ```php
> Item_OperatingSystem, Item_Devices, Infocom, Item_Disk, Item_Process,
> Item_Environment, Item_SoftwareVersion, Item_SoftwareLicense, Contract_Item,
> Document_Item, NetworkPort, Asset_PeripheralAsset, Item_RemoteManagement,
> ItemAntivirus, Domain_Item, Item_Project, ItemVirtualMachine, Socket, ...
> ```

Um ativo é um **agregado**: além dos seus campos, referencia dezenas de itens-filhos.
- **Componentes de hardware**: `Item_Devices` (CommonDBRelation) liga o ativo a **18 tipos de
  device** — `DeviceProcessor`, `DeviceMemory`, `DeviceHardDrive`, `DeviceNetworkCard`,
  `DeviceGraphicCard`, `DeviceMotherboard`, `DevicePowerSupply`, `DeviceBattery`,
  `DeviceControl`, `DeviceDrive`, `DevicePci`, `DeviceCase`, `DeviceFirmware`, `DeviceSensor`,
  `DeviceSimcard`, `DeviceCamera`, `DeviceSoundCard`, `DeviceGeneric`.
- **Outros filhos**: sistema operacional, discos, antivírus, portas de rede, VMs, software,
  periféricos conectados (`Asset_PeripheralAsset`), documentos, contratos.

## Sustenta
- [[Composição de um Ativo (componentes)]]
- [[Modelo de Ativos (padrão comum)]]
