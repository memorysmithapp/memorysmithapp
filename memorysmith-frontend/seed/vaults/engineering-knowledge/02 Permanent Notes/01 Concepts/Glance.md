---
title: Glance
aliases:
  - OpenStack Image Service
  - Image Service
tags:
  - openstack
  - image
  - storage
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de imagem do OpenStack: gerencia o ciclo de vida das imagens que servem de template para instâncias, e dos snapshots delas derivados.

## Conceito

Toda instância nasce de uma imagem. O Glance guarda o **catálogo e os metadados** dessas imagens — mas não necessariamente os bits. É essa separação que define o serviço: o `glance-api` é leve e vive no [[Control Plane]]; o armazenamento propriamente dito é delegado a um backend.

## Características

**Backends suportados:** [[Swift]], [[Cinder]], [[Ceph]] (via RBD), VMware, filesystem local e **Amazon S3**. A partir do Antelope, o `glance-api` pode operar **múltiplos backends simultaneamente**, escolhendo por propriedade — por exemplo, direcionando imagens a um volume Cinder SSD e outras a um HDD.

**Formatos de disco** (11+ no Antelope): RAW, QCOW2, VDI, VHD, ISO, OVA, PLOOP, Docker, e os formatos de compatibilidade AWS — AKI, AMI, ARI.

**Propriedades de imagem** consumidas pelo scheduler do [[Nova]]: `hw_architecture` (arquitetura de hardware) e `img_hv_type` (tipo de hipervisor). É assim que uma imagem "exige" um host KVM.

> [!tip] Swift como backend é a escolha de deployments grandes
> Usar object storage para templates e snapshots funciona como backup interno seguro. Estender o backend a um bucket S3 amplia o domínio de tolerância a falha para fora do data center.

## Veja também

- [[Nova]]
- [[Swift]]
- [[Cinder]]
- [[Snapshot]]
- [[Object Storage]]
