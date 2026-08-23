---
title: Manila
aliases:
  - OpenStack Shared File Systems Service
  - File Share Service
tags:
  - openstack
  - storage
  - file-storage
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Serviço de sistemas de arquivos compartilhados do OpenStack: oferece acesso simultâneo a um mesmo share por múltiplos clientes, em autosserviço.

## Conceito

Introduzido no release **Liberty** para atender a necessidade de armazenamento colaborativo central — a mesma que motiva NAS em infraestrutura tradicional. Segue a lógica de fluxo do [[Cinder]], mas para arquivo em vez de bloco.

É o único serviço de armazenamento do OpenStack que **consome os outros**: cria instâncias no [[Nova]] para rodar os share servers, redes no [[Neutron]] para dar acesso, e volumes no [[Cinder]] para respaldar o share.

## Estrutura

| Componente | Papel |
|---|---|
| **Share server** | Unidade de storage que hospeda os shares |
| **API server** | REST de requisições de cliente |
| **Scheduler** | Escolhe o melhor share server |
| **Data service** | Backup, recuperação e migração |

## Características

- **Protocolos suportados:** NFS, GlusterFS, CephFS, CIFS, HDFS, MapRFS.
- **Mais de 25 drivers de backend**, entre eles LVM, EMC, IBM, Hitachi NAS.
- **Agendamento:** `DriverFilter` + `GoodnessWeigher`, mesma sintaxe do Cinder. Propriedades disponíveis via `manila extra-specs-list`.
- **File-share access control** (Bobcat) permite travar um share contra deleção acidental.

## Veja também

- [[File Storage]]
- [[Cinder]]
- [[Swift]]
- [[Ceph]]
