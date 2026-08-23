---
title: Control Plane
aliases:
  - Plano de Controle
  - Control Plane vs Data Plane
tags:
  - architecture
  - networking
  - distributed-systems
  - cloud
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Conjunto de componentes que decide **como** uma requisição será atendida, em oposição ao data plane, que efetivamente move o dado.

## Conceito

O termo vem do vocabulário de redes e foi emprestado por sistemas distribuídos e plataformas de nuvem. A separação conceitual responde a duas perguntas distintas:

- **Control plane** — quem autoriza, quem decide onde, quem registra o estado.
- **Data plane** — por onde o pacote, o bloco ou a instrução realmente passa.

A utilidade prática da distinção é de **projeto de falha**: os dois planos falham de formas diferentes, escalam de formas diferentes e exigem estratégias de disponibilidade diferentes.

## Características

| | Control plane | Data plane |
|---|---|---|
| Responde | Como atender? | Mover o dado |
| Volume | Requisições de gestão | Tráfego de produção |
| Padrão típico | Stateless nas APIs, stateful no banco e fila | Alto throughput, baixa latência |
| Falha significa | Não consigo criar/alterar recursos | Recursos existentes param de funcionar |

> [!important] O plano de controle pode cair sem derrubar a carga
> Num desenho saudável, perder o control plane impede **novas** operações, mas as instâncias já em execução seguem servindo tráfego. Se isso não for verdade no seu sistema, há acoplamento indevido.

## Exemplo — OpenStack

**Control plane:** APIs de todos os serviços, schedulers, [[Keystone]], [[Placement]], banco de dados e fila AMQP — concentrados no *cloud controller*.

**Data plane:** o hipervisor rodando as instâncias, o overlay de rede tenant, as redes externa e de storage.

## Veja também

- [[Distributed Systems]]
- [[Stateful vs Stateless]]
- [[High Availability]]
- [[Software-Defined Networking (SDN)]]
