---
title: Container
aliases:
  - Contêiner
  - Docker
tags:
  - cloud-native
  - devops
  - containers
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Container é uma unidade de empacotamento que reúne a aplicação e todas as suas dependências em um ambiente isolado, executável de forma idêntica em qualquer host compatível.

## Conceito

O contêiner responde ao problema clássico do "funciona na minha máquina" movendo a fronteira do que é entregue: em vez de entregar o artefato e descrever o ambiente, entrega-se o ambiente junto. Diferente de uma máquina virtual, o contêiner compartilha o kernel do host — o que o torna leve o suficiente para subir em segundos e denso o suficiente para caber às dezenas em uma máquina.

## Comparação

| | **Container** | **Máquina Virtual** |
|---|---|---|
| Isolamento | Processo, via namespaces e cgroups | Hardware virtualizado |
| Kernel | Compartilhado com o host | Próprio, por instância |
| Inicialização | Segundos | Minutos |
| Densidade por host | Alta | Baixa |
| Superfície de ataque | Maior — kernel compartilhado | Menor |

## Características

- **Imutável por natureza**: mudança gera nova imagem, não alteração do que está rodando — base de [[Immutable Infrastructure]]
- Imagem em camadas, com reuso e cache entre builds
- Docker é a plataforma que popularizou o formato, operando no nível do **host individual**
- Escalar para muitos hosts exige [[Container Orchestration]]

> [!warning]
> Imagens infladas são um dos [[Cloud Native Anti-Patterns]] mais comuns: aumentam o tempo de deploy, consomem mais recursos e retardam a escala justamente no momento de pico.

## Veja também

- [[Processo (Computação)]]
- [[Processo de Boot do Linux]]

- [[Container Orchestration]]
- [[Kubernetes (K8s)]]
- [[Immutable Infrastructure]]
- [[Cloud Native]]
- [[Serverless]]
- [[Microservices]]
- [[Infrastructure as Code]]
