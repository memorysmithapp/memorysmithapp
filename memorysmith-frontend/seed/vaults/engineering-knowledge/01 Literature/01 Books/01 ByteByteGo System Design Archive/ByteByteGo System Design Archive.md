---
title: ByteByteGo System Design Archive
aliases:
  - BIG ARCHIVE - System Design 2023
  - ByteByteGo Big Archive
tags:
  - system-design
  - distributed-systems
  - cloud-native
  - microservices
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
year: 2023
---
## Resumo

Compilação anual do ByteByteGo com cerca de 180 tópicos de **System Design** explicados em um diagrama e algumas centenas de palavras cada. Não é um livro de tese: é um arquivo de *cheat sheets* que cobre redes, APIs, bancos de dados, cache, mensageria, contêineres, Kubernetes, CI/CD, segurança e as *tech stacks* de Netflix, Uber e outras Big Techs.

> [!info] Natureza da fonte
> O valor da obra está na **densidade de conceitos por página**, não na profundidade de cada um. Cada tópico é um ponto de partida — a nota permanente extraída daqui costuma precisar de complemento de outras fontes antes de chegar a `evergreen`.

> [!success] Extração concluída
> As cinco partes do arquivo relevantes ao vault foram extraídas em três fases, resultando em **57 notas permanentes** no cluster de System Design. Cada nota registra a fonte primária que a sustenta em `## Fonte`; o arquivo serviu de mapa do que valia documentar, não de autoridade única.

## Índice

[[ByteByteGo System Design Archive 01|Parte 1: Sistemas Distribuídos e Escalabilidade]]
[[ByteByteGo System Design Archive 02|Parte 2: Cloud Native, DevOps e Microsserviços]]
[[ByteByteGo System Design Archive 03|Parte 3: APIs, Protocolos e Segurança]]
[[ByteByteGo System Design Archive 04|Parte 4: Dados, Transações e Pipelines]]
[[ByteByteGo System Design Archive 05|Parte 5: Redes e Sistema Operacional]]

## Cobertura do arquivo

| Domínio                                                                   | Extraído?                  |
| ------------------------------------------------------------------------- | -------------------------- |
| Sistemas distribuídos e escalabilidade                                    | ✅ Fase 1                   |
| Cloud Native, DevOps e microsserviços                                     | ✅ Fase 1                   |
| APIs, protocolos e segurança (REST, GraphQL, gRPC, OAuth, JWT, TLS)       | ✅ Fase 2                   |
| Dados e mensageria em profundidade (ACID/BASE, tipos de banco, pipelines) | ✅ Fase 2                   |
| Redes e sistema operacional (OSI, TCP/IP, Linux, DNS, processos)          | ✅ Fase 3                   |
| Git, padrões de projeto e carreira                                        | ⏸️ Fora de escopo do vault |

## Links Principais

- [[System Design MOC]]
- [[Microservices]]
- [[Cloud Native]]
- [[Kubernetes (K8s)]]
- [[Estilos de Arquitetura de API]]
- [[ACID]]
- [[Modelo OSI]]

---
Ref: [[System Design MOC]], [[Observability]], [[CAP Theorem]]
