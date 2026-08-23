---
title: Versionamento Semântico (SemVer)
aliases:
  - SemVer
  - Semantic Versioning
tags:
  - software-engineering
  - release
  - devops
  - governance
type: concept
status: evergreen
source: Tom Preston-Werner, "Semantic Versioning 2.0.0" (semver.org)
author: Tom Preston-Werner
created: 2026-07-25
---
> [!abstract]
> SemVer é a convenção `MAJOR.MINOR.PATCH` em que cada segmento comunica, por si só, o impacto da mudança sobre quem consome o software: quebra, adiciona ou corrige.

## Conceito

A versão é um **contrato de comunicação**, não um contador. Antes do SemVer, a única forma de saber se uma atualização quebrava a integração era lê-la inteira. A convenção transfere essa informação para o número:

| Segmento | Incrementa quando | Efeito no consumidor |
|---|---|---|
| **MAJOR** | Mudança incompatível na interface pública | Precisa agir antes de atualizar |
| **MINOR** | Funcionalidade nova, retrocompatível | Pode atualizar; ganha algo |
| **PATCH** | Correção retrocompatível | Pode atualizar sem ler |

A regra que dá sentido a todas: ao incrementar MAJOR, zera-se MINOR e PATCH; ao incrementar MINOR, zera-se PATCH.

> [!important] SemVer só existe se a interface pública estiver declarada
> Sem definir o que é público, "mudança incompatível" é opinião. O que está documentado como interface é contrato; o resto é interno e pode mudar em PATCH.

## Onde SemVer não se aplica sozinho

Um produto real versiona coisas de naturezas diferentes, e forçar tudo em um número só produz confusão:

| Camada | Instrumento | Pergunta que responde |
|---|---|---|
| Produto | SemVer (`1.4.2`) | Que conjunto coordenado de mudanças foi liberado? |
| Contrato de API | Prefixo inteiro (`/v1`, `/v2`) — ver [[Versionamento de API]] | Que formato de requisição e resposta este cliente fala? |
| Implantação | Identificador de build, alias de ambiente | Que código exatamente está rodando agora? |

O prefixo da API **não é SemVer**: incrementa isoladamente, só quando um contrato precisa mudar de forma incompatível enquanto o anterior segue no ar. E o identificador de build (hash do commit) responde a uma pergunta operacional que a versão de produto não responde — qual artefato exato está em produção neste instante.

## Prática

- A versão tem **uma fonte de verdade** declarada; todos os outros lugares são cópias propagadas por automação
- A tag Git `vX.Y.Z` é o marcador imutável de release — é nela que o pipeline se apoia
- O changelog é escrito para quem consome, não para quem escreveu: descreve o efeito, não o commit
- Versão de pré-lançamento (`1.0.0-rc.1`) ordena-se **antes** da estável correspondente

## Veja também

- [[Versionamento de API]]
- [[Estratégia de Versionamento em Três Camadas]]
- [[Pipeline de CI-CD]]
- [[Release Management]]
