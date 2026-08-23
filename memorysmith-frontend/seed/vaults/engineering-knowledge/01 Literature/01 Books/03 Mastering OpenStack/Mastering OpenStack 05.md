---
title: Mastering OpenStack 05
aliases:
  - "Capítulo 5: OpenStack Storage – Block, Object, and File Shares"
tags:
  - openstack
  - storage
  - cinder
  - swift
  - manila
  - ceph
  - software-defined-storage
type: literature
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
chapter: 5
---
## Resumo executivo

Três serviços, três modelos de armazenamento, três arquiteturas distintas: **Cinder** (bloco persistente), **Swift** (objeto distribuído) e **Manila** (compartilhamento de arquivos). O capítulo mostra que a escolha não é sobre qual é melhor, mas sobre qual caso de uso cada um resolve — e como o **[[Software-Defined Storage (SDS)]]** permitiu que tudo isso rodasse sobre hardware commodity.

O eixo comum é a **multiplicidade de backends**: Cinder e Manila ganharam mecanismos de filtragem e pesagem próprios justamente porque um mesmo deployment hoje expõe LVM, NFS e Ceph ao mesmo tempo.

## Principais ideias

- **Bloco persistente × disco efêmero.** O volume Cinder sobrevive à terminação da instância; o disco efêmero não. Essa é a distinção que define quando usar cada um.
- **A matriz de drivers é documento de projeto, não detalhe.** Nem todo backend suporta todas as funções do Cinder. O autor recomenda varrer a *support matrix* **antes** de decidir a arquitetura de storage.
- **Swift dimensiona-se de trás para frente.** Da capacidade útil desejada → réplicas → overhead do XFS → número de discos → número de nós.
- **O ring é o coração do Swift.** É o mapa lógico entre objeto/conta/container e localização física. E, no Kolla, sua geração **não é automatizada** — é script manual.
- **Manila é o único serviço de storage que consome os outros.** Cria instâncias no Nova, rede no Neutron e volumes no Cinder para servir o share.

## Conceitos apresentados

### Cinder — block storage

| Componente | Onde roda | Papel |
|---|---|---|
| `cinder-api` | Controller | REST de block storage |
| `cinder-scheduler` | Controller | Filtra e encaminha ao `cinder-volume` adequado |
| `cinder-volume` | Storage node | Gerente de volume; fala com o driver do backend |
| `cinder-backup` | — | Backup de volumes para outros sistemas |

Protocolos de acesso ao volume: **iSCSI, NFS, Fibre Channel**.

**Funções obrigatórias de qualquer driver:** attach, detach, create, delete, extend, migrate, criar imagem a partir de volume; e gestão de snapshot (criar, apagar, criar volume a partir de snapshot ou clone).

**Funções opcionais:** thin provisioning, live migration, multi-attach, QoS.

> [!info] Segurança no Antelope
> A maior parte dos drivers Cinder passou a suportar **TLS** — criptografia em trânsito e em repouso. Era um bloqueador histórico para times de segurança.

#### Filtragem e pesagem do Cinder

Padrão: `CapacityFilter` + `CapacityWeigher`.

| Weigher | Comportamento |
|---|---|
| `CapacityWeigher` | Pesa pela capacidade livre |
| `VolumeNumberWeigher` | Espalha volumes uniformemente entre backends de mesmo nome |
| `GoodnessWeigher` | Avalia uma `goodness_function` no formato `"(regra)? valor1 : valor2"`, atribuindo peso de 0 a 100 |

```ini
# /etc/kolla/config/cinder/cinder.conf
[default]
scheduler_default_filters = DriverFilter,CapacityFilter,CapabilitiesFilter
scheduler_default_weighers = GoodnessWeigher

[lvm-1]
goodness_function = "(capabilities.utilization < 50.0)?50:30"

[rbd]
goodness_function = "(capabilities.utilization < 50.0)?80:20"
```

Leitura da regra acima: enquanto ambos estão abaixo de 50% de uso, o **rbd vence** (80 × 50). Passando de 50% nos dois, o **lvm vence** (30 × 20) — inverte-se a preferência conforme o Ceph enche.

#### Volume types — como o usuário escolhe o backend

```bash
openstack volume type create lvm_standard
openstack volume type set lvm_standard --property volume_backend_name=lvm-1
openstack volume type create rbd_large
openstack volume type set rbd_large --property volume_backend_name=rbd-1

openstack volume create --size 10 --type lvm_standard general_volume
openstack volume create --size 50 --type rbd_large    large_volume
```

Quando dois backends compartilham o mesmo `volume_backend_name`, o scheduler decide entre eles pelos filtros e pesos.

### Ceph — os quatro componentes lógicos

| Componente | O que é |
|---|---|
| **OSD** (Object Storage Device) | Corresponde ao disco físico com filesystem (XFS, Btrfs) |
| **MON** (Monitor daemon) | Vigia a consistência dos dados e as métricas de cada OSD |
| **Pool** | Mapeamento dos objetos armazenados em OSDs |
| **PG** (Placement group) | Mapa objeto ↔ OSDs; replica objetos entre múltiplos OSDs de um pool |

No núcleo está o **RADOS** (Reliable Autonomic Distributed Object Store), que cuida de distribuição, replicação e gestão dos objetos. Ceph escala a exabytes sobre x86 commodity e serve os três tipos de interface: objeto, bloco e arquivo.

### Swift — object storage

| Componente | Papel |
|---|---|
| **Account server** | Namespace da lista de containers de uma conta |
| **Container server** | Área definida pelo usuário; guarda a lista de objetos |
| **Object server** | Gerencia o objeto real e seus metadados. Todo objeto pertence a um container |
| **Proxy server** | Recebe as requisições HTTP/API: criar container, upload, delete |
| **Partition** | Gerencia a localização de objetos, containers e bancos de conta |
| **Zone** | Isolamento físico — impede perda ampla de dados numa falha zonal |
| **Ring** | Mapa lógico entre objeto/conta/container e localização física. **Um ring por construto** |

> [!warning] O swift-proxy no controller é dívida técnica planejada
> Manter o proxy no cloud controller sobrecarrega os recursos do control plane conforme o cluster cresce. O autor recomenda monitorar as requisições de API de objeto e mover o proxy para hardware dedicado antes que doa.

**Três interfaces de rede recomendadas:** `swift_storage_interface` (proxy ↔ nós), interface de replicação dedicada (opcional, entre nós de storage) e `kolla_external_vip_interface` (acesso público à API, opcional).

### Manila — file shares

| Componente | Papel |
|---|---|
| **Share server** | Unidade de storage que hospeda os shares |
| **API server** | REST de requisições de cliente |
| **Scheduler** | Escolhe o melhor share server |
| **Data service** | Backup, recuperação e migração |

Protocolos suportados até o Bobcat: **NFS, GlusterFS, CephFS, CIFS, HDFS, MapRFS**. Mais de 25 drivers de backend.

Dependências entre serviços: **Nova** (instâncias que rodam os share servers), **Neutron** (acesso à rede do tenant), **Cinder** (o share como volume de bloco).

Padrões de agendamento: `DriverFilter` + `GoodnessWeigher`, mesma sintaxe do Cinder, configurados em `manila.conf`. As propriedades disponíveis vêm de `manila extra-specs-list`.

> [!info] Novidades e depreciações
> O Bobcat trouxe **file-share access control** — o share pode ser travado contra deleção acidental. E a partir do Antelope, a **CLI do Manila está planejada para depreciação**: usar a `openstack` CLI.

## Exemplos

### Dimensionamento de um cluster Swift

Premissas: 100 TB úteis, chassi de 50 slots, discos de 3 TB, 3 réplicas, filesystem XFS.

```
Capacidade bruta   = 100 TB × 3 réplicas          = 300 TB
Overhead do XFS    = 300 × 1,0526                 = 316 TB
Número de discos   = 316 / 3 TB                   = 106 discos
Número de nós      = 106 / 50 slots               = 3 nós
```

### Construção dos rings

```
swift-ring-builder <builder_file> create <part_power> <replicas> <min_part_hours>
```

| Parâmetro | Significado |
|---|---|
| `builder_file` | `account.builder`, `container.builder` ou `object.builder` |
| `part_power` | Potência de 2 mais próxima do número de partições. Para 50 discos → **11** (≈ 2.048 partições). Arredonde para cima |
| `replicas` | **3** é o valor recomendado |
| `min_part_hours` | Horas mínimas durante as quais só uma réplica de uma partição pode se mover |

Portas por serviço na adição de dispositivos: **6000** (object), **6001** (account), **6002** (container). Ao final, `rebalance` em cada ring.

> [!tip] Calculadora de ring
> O Rackspace Lab publica uma ferramenta online para calcular o ring: https://rackerlabs.github.io/swift-ppc/

### Preparação do filesystem dos nós de storage

```bash
for i in sdc sdd sde; do
  parted /dev/${i} -s -- mklabel gpt mkpart KOLLA_SWIFT_DATA 1 -1
done

loop=0
for i in sdc sdd sde; do
  mkfs.xfs -f -L i${loop} /dev/${i}1
  (( loop++ ))
done
```

O rótulo `KOLLA_SWIFT_DATA` precisa bater com `swift_devices_name` no `globals.yml`.

### Habilitação dos três backends de Cinder

```yaml
# /etc/kolla/globals.yml
enable_cinder_backend_lvm: "yes"
cinder_volume_group: "cinder-volumes"     # exige pvcreate + vgcreate prévios

enable_cinder_backend_nfs: "yes"          # exige nfs-common nos nós compute e storage

cinder_backend_ceph: "yes"
ceph_cinder_keyring: "ceph.client.cinder.keyring"
ceph_cinder_user: "cinder"
ceph_cinder_pool_name: "cinder-volumes"
```

Para Ceph, o fluxo é: criar o pool (`ceph osd pool create cinder-volumes 256`), inicializá-lo (`rbd pool init`), gerar o keyring com `ceph auth get-or-create client.cinder` e distribuí-lo ao deployer, storage e compute.

---
Ref: [[Mastering OpenStack]], [[Mastering OpenStack 04]], [[Mastering OpenStack 06]], [[Cinder]], [[Swift]], [[Manila]], [[Ceph]], [[Software-Defined Storage (SDS)]], [[Block Storage]], [[Object Storage]], [[File Storage]]
