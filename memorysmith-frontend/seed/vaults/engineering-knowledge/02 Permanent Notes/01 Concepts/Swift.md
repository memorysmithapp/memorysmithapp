---
title: Swift
aliases:
  - OpenStack Object Storage Service
  - Object Storage Service
tags:
  - openstack
  - storage
  - object-storage
  - eventual-consistency
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de armazenamento de objetos do OpenStack: guarda dados não estruturados em hierarquia plana, replicados, sobre hardware commodity, sem ponto único de falha.

## Conceito

Junto com o [[Nova]], veio no primeiro release (Austin, 2010). Resolve o problema de armazenamento que o modelo persistente tradicional não resolve: volume massivo de dado não estruturado, acessível por HTTP, escalável horizontalmente e barato.

Casos de uso dominantes: **arquivamento, backup e recuperação de desastre**.

## Estrutura

| Componente | Papel |
|---|---|
| **Account server** | Namespace da lista de containers de uma conta |
| **Container server** | Área definida pelo usuário; guarda a lista de objetos |
| **Object server** | Gerencia o objeto real e seus metadados |
| **Proxy server** | Recebe as requisições HTTP/API |
| **Partition** | Gerencia a localização de objetos, containers e bancos de conta |
| **Zone** | Isolamento físico — contém a perda numa falha zonal |
| **Ring** | Mapa lógico entre construto e localização física. **Um ring por construto** |

## Características

- **Sem SPOF por desenho.**
- **API REST HTTP** para gestão de objeto.
- **Consistência eventual** — ver [[Eventual Consistency]].
- **Escala horizontal** sobre hardware barato.

### O ring

É o coração do serviço. Construído com `swift-ring-builder`:

```
swift-ring-builder <builder> create <part_power> <replicas> <min_part_hours>
```

- `part_power` — potência de 2 mais próxima do número de partições. Para 50 discos, 11 (≈ 2.048).
- `replicas` — 3 é o valor recomendado.
- `min_part_hours` — janela em que só uma réplica de uma partição pode se mover.

### Dimensionamento

Raciocínio de trás para frente, a partir da capacidade útil:

```
bruto  = útil × réplicas
real   = bruto × 1,0526        (overhead de metadados do XFS)
discos = real ÷ capacidade do disco
nós    = discos ÷ slots por chassi
```

## Comparação

| | Swift ([[Object Storage]]) | [[Cinder]] ([[Block Storage]]) |
|---|---|---|
| Hierarquia | Plana (conta → container → objeto) | Dispositivo de bloco |
| Acesso | HTTP REST | iSCSI, NFS, Fibre Channel |
| Consistência | Eventual | Forte |
| Uso típico | Arquivo, backup, mídia | Disco de instância, banco |

## Veja também

- [[Object Storage]]
- [[Cinder]]
- [[Manila]]
- [[Eventual Consistency]]
