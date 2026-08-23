---
title: Infrastructure as Code
aliases:
  - IaC
  - Infraestrutura como Código
tags:
  - engineering
  - devops
  - automation
type: concept
status: evergreen
source: ITIL Foundation (Version 5), PeopleCert, 2026
author: PeopleCert
created: 2026-07-25
---
> [!abstract]
> Infrastructure as Code é a prática de definir e provisionar infraestrutura por meio de arquivos versionados e executáveis, em vez de configuração manual.

## Conceito

O ganho central não é velocidade de provisionamento, é **reprodutibilidade**: o ambiente passa a ser um artefato reconstruível, versionado e revisável como qualquer código.

Para o ITIL, IaC muda a natureza de duas práticas. [[Service Configuration Management]] deixa de depender de descoberta e passa a ter a definição como fonte da verdade; [[Change Enablement]] passa a poder revisar a mudança de infraestrutura como diff.

## Características

- Ambiente descrito declarativamente e versionado
- Reprodutível, revisável e reversível
- Elimina desvio de configuração entre ambientes
- Torna a mudança de infraestrutura auditável por diff

## Veja também

- [[Service Configuration Management]]
- [[Deployment Management]]
- [[Platform Engineering]]
- [[Change Enablement]]
