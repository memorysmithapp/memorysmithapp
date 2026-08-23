---
title: Retry Pattern
aliases:
  - Retentativa
  - Exponential Backoff
  - Backoff
  - Jitter
tags:
  - resilience
  - distributed-systems
  - system-design
type: concept
status: evergreen
source: Timeouts, retries, and backoff with jitter — Amazon Builders' Library
author: Marc Brooker (AWS)
created: 2026-07-25
---
> [!abstract]
> Retry é reenviar a mesma requisição para sobreviver a falhas parciais e transitórias. É eficaz e perigoso na mesma medida: **retentativas são egoístas**, pois gastam mais tempo do servidor para aumentar a chance de sucesso do próprio cliente.

## Conceito

Sistemas distribuídos raramente falham como uma unidade. Sofrem falhas **parciais** (uma fração das requisições falha) e **transitórias** (falha por um curto período). Nesses dois casos, tentar de novo costuma funcionar.

O problema aparece quando a falha é causada por **sobrecarga**. Aí a retentativa aumenta a carga, piora a situação e pode atrasar a recuperação mantendo a carga alta muito depois de o problema original ter sido resolvido.

> [!warning] Retry é um remédio potente
> Útil na dose certa, capaz de causar dano significativo em excesso. E, em sistemas distribuídos, praticamente não há como coordenar todos os clientes para acertar a dose.

## Backoff e jitter

**Exponential backoff** — o intervalo entre tentativas cresce exponencialmente. Como a função cresce rápido, implementações limitam o valor máximo: é o *capped exponential backoff*. Mas isso cria outro problema — todos os clientes passam a retentar constantemente na taxa do teto. A solução usual é **limitar o número de retentativas** e tratar a falha mais cedo na arquitetura.

**Jitter** — quando a falha vem de sobrecarga ou contenção, o backoff sozinho ajuda menos do que parece, por causa da **correlação**: se todas as chamadas recuam pelo mesmo tempo, elas voltam juntas e recriam a sobrecarga. O jitter adiciona aleatoriedade ao intervalo, espalhando as retentativas no tempo.

```mermaid
flowchart LR
    F[Falha] --> B1[Espera 1s ± jitter]
    B1 --> T1[Tentativa 2]
    T1 -->|falha| B2[Espera 2s ± jitter]
    B2 --> T2[Tentativa 3]
    T2 -->|falha| B3[Espera 4s ± jitter]
    B3 --> G[Desiste e propaga o erro]
```

> [!tip] Jitter não é só para retry
> O tráfego costuma chegar em picos curtos, muitas vezes escondidos por métricas agregadas. Vale adicionar jitter a **todos os timers, jobs periódicos e trabalhos adiados** — clientes que disparam "uma vez por minuto" se alinham no primeiro segundo do minuto.
>
> Em trabalho agendado, o jitter deve ser **consistente por host**, não aleatório a cada execução: se houver sobrecarga, ela acontece sempre no mesmo padrão, e padrão é o que o humano consegue diagnosticar.

## Regras

- **Retentar em um único ponto da pilha.** Cinco camadas com três tentativas cada multiplicam a carga no banco por **243×**, tornando a recuperação improvável
- **Só retentar o que é seguro retentar.** APIs com efeito colateral exigem [[Idempotência]]; um timeout não significa que o efeito não aconteceu
- **Distinguir erro do cliente de erro do servidor.** HTTP separa 4xx de 5xx: o 4xx não vai passar a funcionar. A consistência eventual, porém, borra essa linha
- **Limitar localmente com token bucket** em vez de recorrer sempre ao [[Circuit Breaker]] — o breaker introduz comportamento modal difícil de testar e pode acrescentar tempo à recuperação

## Fonte

- Marc Brooker, [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), Amazon Builders' Library

## Veja também

- [[Timeout]]
- [[Idempotência]]
- [[Circuit Breaker]]
- [[Rate Limiting]]
- [[Bulkhead]]
- [[Distributed Systems]]
- [[System Design MOC]]
