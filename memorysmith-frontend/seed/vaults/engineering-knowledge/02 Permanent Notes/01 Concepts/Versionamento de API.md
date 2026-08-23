---
title: Versionamento de API
aliases:
  - API Versioning
  - Versionamento
tags:
  - api
  - architecture
  - system-design
type: concept
status: evergreen
source: Top 12 Tips for API Security — BIG ARCHIVE System Design 2023; GraphQL Best Practices
author: ByteByteGo (Alex Xu, Sahn Lam) · GraphQL Foundation
created: 2026-07-25
---
> [!abstract]
> Versionamento de API é a estratégia para **evoluir o contrato sem quebrar quem já o consome** — problema que só existe porque o produtor não controla o cronograma do consumidor.

## Conceito

Uma API publicada é uma promessa. Alterar um campo obrigatório, remover um endpoint ou mudar o formato de uma resposta quebra clientes que o produtor não conhece e não pode atualizar.

A pergunta central é: **mudanças compatíveis ou incompatíveis?** Adicionar um campo opcional é compatível — clientes antigos o ignoram. Remover ou renomear não é.

## Estratégias

| Estratégia | Exemplo | Consequência |
|---|---|---|
| **Na URI** | `/v1/pedidos` | Explícito e simples; duplica rotas e viola a ideia de URI como identificador estável do recurso |
| **No cabeçalho** | `Accept: application/vnd.api.v2+json` | Mantém a URI limpa; menos visível e mais fácil de errar |
| **Por parâmetro** | `?version=2` | Simples, mas polui o cache e a semântica de consulta |
| **Sem versão, só evolução compatível** | Campos novos são aditivos; os velhos são depreciados | Abordagem de [[GraphQL]], que se declara *versionless* |

## Regras

1. **Versionar é o último recurso, não o primeiro.** Cada versão viva é código a manter, testar e operar. A maior parte da evolução cabe em mudanças aditivas.
2. **Depreciar antes de remover**, com prazo anunciado e telemetria mostrando quem ainda usa.
3. **Nunca reinterpretar um campo existente.** Mudar o significado de `status` sem mudar o nome é a quebra silenciosa mais difícil de detectar.
4. **Clientes robustos ajudam:** ignorar campos desconhecidos e tolerar valores novos de enum permite ao produtor evoluir sem coordenação.

> [!important] Versionamento é um controle de segurança
> Aparece na lista das doze práticas de [[Segurança de API]] por um motivo direto: sem versionamento não é possível **corrigir uma falha** que exige mudança incompatível — a única saída seria quebrar todos os clientes de uma vez, o que nenhuma organização faz sob pressão de incidente.

## Fonte

- ByteByteGo, *Top 12 Tips for API Security* — BIG ARCHIVE: System Design 2023
- GraphQL Foundation, [Schema Design — versioning](https://graphql.org/learn/schema-design/)

## Veja também

- [[REST API]]
- [[GraphQL]]
- [[Segurança de API]]
- [[SOAP]]
- [[Estilos de Arquitetura de API]]
- [[System Design MOC]]
