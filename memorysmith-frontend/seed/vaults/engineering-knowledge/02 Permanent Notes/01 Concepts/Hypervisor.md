---
title: Hypervisor
aliases:
  - Hipervisor
  - Virtual Machine Monitor (VMM)
tags:
  - virtualization
  - infrastructure
  - compute
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Camada de software que abstrai o hardware físico e permite que múltiplas máquinas virtuais compartilhem o mesmo host, cada uma com a ilusão de hardware dedicado.

## Conceito

É o que torna a nuvem [[Infrastructure as a Service (IaaS)]] economicamente viável: sem ele, cada workload exigiria uma máquina física, e a taxa de ociosidade tornaria o modelo insustentável.

Duas famílias clássicas:

| Tipo | Onde roda | Exemplos |
|---|---|---|
| **Tipo 1 (bare metal)** | Direto sobre o hardware | KVM, VMware ESXi, Hyper-V, Xen |
| **Tipo 2 (hosted)** | Sobre um sistema operacional | VirtualBox, VMware Workstation |

## Características

- Permite **[[Overcommitment]]** — alocar mais vCPU e memória virtual do que existe fisicamente, apostando que nem todas as VMs pedem o pico ao mesmo tempo.
- É a camada que **[[Ironic]]** elimina, ao provisionar metal puro.
- No Linux, **KVM** é um módulo de kernel (`kvm_intel` ou `kvm_amd`), operado via **libvirt** e **QEMU**.

## Comparação

| | Hypervisor | [[Container]] |
|---|---|---|
| Isola | Hardware completo | Processo e namespaces |
| Kernel | Um por VM | Compartilhado com o host |
| Boot | Segundos a minutos | Milissegundos |
| Densidade | Dezenas por host | Centenas por host |
| Fronteira de segurança | Mais forte | Mais fraca |

## Veja também

- [[Overcommitment]]
- [[Nova]]
- [[Container]]
- [[Ironic]]
