---
title: Chaos Engineering
aliases:
  - Engenharia do Caos
  - Chaos Monkey
tags:
  - resilience
  - operations
  - testing
  - system-design
type: concept
status: evergreen
source: Principles of Chaos Engineering — principlesofchaos.org, 2019
author: Chaos Community (Netflix e colaboradores)
created: 2026-07-25
---
> [!abstract]
> Chaos Engineering é a disciplina de **experimentar sobre um sistema** para construir confiança na sua capacidade de suportar condições turbulentas em produção.

## Conceito

Mesmo quando todos os serviços individuais funcionam corretamente, as **interações entre eles** produzem resultados imprevisíveis. Somados a eventos raros mas disruptivos do mundo real, esses sistemas distribuídos são inerentemente caóticos.

O objetivo é identificar fraquezas **antes** que elas se manifestem como comportamento aberrante em escala: fallback mal configurado, tempestade de retentativas por timeout mal ajustado, dependência recebendo tráfego demais, falha em cascata a partir de um ponto único.

> [!important] Não é quebrar coisas por esporte
> É um método **empírico e controlado**. A palavra que define a prática é *experimento*, não *sabotagem*.

## Os quatro passos do experimento

```mermaid
flowchart LR
    A[1. Definir o estado estável<br/>como saída mensurável] --> B[2. Hipótese: o estado estável<br/>se mantém nos dois grupos]
    B --> C[3. Introduzir variáveis<br/>de eventos reais]
    C --> D[4. Tentar refutar a hipótese<br/>comparando controle e experimento]
    D -->|fraqueza encontrada| E[Alvo de melhoria]
```

Quanto mais difícil for perturbar o estado estável, maior a confiança no comportamento do sistema.

## Os cinco princípios avançados

| Princípio | O que significa |
|---|---|
| **Hipótese sobre o estado estável** | Focar na **saída mensurável** — throughput, taxa de erro, percentis de latência — e não em atributos internos. O caos verifica *que* o sistema funciona, não *como* |
| **Variar eventos do mundo real** | Priorizar por impacto ou frequência: falha de hardware, resposta malformada, pico de tráfego, evento de escala |
| **Rodar em produção** | O sistema se comporta de forma diferente conforme ambiente e padrão de tráfego. Só o tráfego real captura o caminho de requisição de forma confiável |
| **Automatizar e rodar continuamente** | Experimento manual é insustentável; a automação orquestra e analisa |
| **Minimizar o raio de alcance** | É obrigação do engenheiro conter e minimizar o impacto sobre clientes reais |

> [!warning] "Rodar em produção" é o princípio mais mal interpretado
> Ele vem acompanhado, no mesmo documento, da obrigação de **minimizar o raio de alcance**. Experimentar em produção sem contenção não é chaos engineering — é incidente autoinfligido.

## Relação com o resto do vault

O caos é a forma de **verificar** que os mecanismos de resiliência funcionam de verdade: [[Circuit Breaker]], [[Retry Pattern]], [[Timeout]], [[Bulkhead]] e [[Load Shedding]] costumam estar configurados e nunca terem sido exercitados sob falha real.

Ferramentas como o Chaos Monkey sobrecarregam CPU ou introduzem perda de pacotes justamente para simular as condições de sobrecarga descritas em [[Load Shedding]].

## Fonte

- Chaos Community, [Principles of Chaos Engineering](https://principlesofchaos.org/), 2019

## Veja também

- [[Load Shedding]]
- [[Circuit Breaker]]
- [[Bulkhead]]
- [[Distributed Systems]]
- [[Observability]]
- [[Site Reliability Engineering (SRE)]]
- [[System Design MOC]]
