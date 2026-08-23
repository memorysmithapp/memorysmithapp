---
title: Software-Defined Storage (SDS)
aliases:
  - SDS
  - Armazenamento Definido por Software
tags:
  - storage
  - architecture
  - distributed-systems
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Abordagem em que o armazenamento de dados é abstraído do hardware físico, permitindo construir sistemas de storage sobre máquinas commodity.

## Conceito

O storage tradicional vem em appliance: o controlador, os discos e o software formam um produto único, do mesmo fornecedor. Escalar significa comprar mais do mesmo, no ritmo e no preço do fabricante.

O SDS separa o software do hardware. A inteligência — replicação, distribuição, snapshot, tiering — vive em software rodando sobre servidores x86 comuns. A capacidade cresce adicionando máquinas.

Foi o que permitiu à comunidade OpenStack adotar múltiplos projetos de storage e oferecer objeto, bloco e arquivo sem depender de fornecedor específico.

## Características

- **Independência de hardware** — commodity x86 em vez de appliance.
- **Escala horizontal** — capacidade e performance crescem com o número de nós.
- **Política em software** — replicação, erasure coding e distribuição são configuração, não SKU.
- **API-first** — integração programática com o resto da plataforma.

> [!warning] Barato no hardware, caro no entendimento
> Construir sobre commodity exige compreender a arquitetura de cada projeto de storage antes de expor o serviço a usuários. O custo migra de licença para conhecimento operacional.

## Exemplo

**[[Ceph]]** é o caso canônico: sobre o núcleo RADOS, entrega as três interfaces — objeto, bloco (RBD) e arquivo (CephFS) — escalando a exabytes sobre x86.

No OpenStack, **[[Swift]]** é SDS nativo para objeto, e **[[Cinder]]** e **[[Manila]]** são camadas de abstração que consomem backends SDS ou proprietários indistintamente.

## Veja também

- [[Ceph]]
- [[Swift]]
- [[Storage]]
- [[Distributed Systems]]
