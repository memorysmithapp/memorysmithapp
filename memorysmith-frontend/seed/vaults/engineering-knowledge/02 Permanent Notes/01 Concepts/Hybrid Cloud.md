---
title: Hybrid Cloud
aliases:
  - Nuvem Híbrida
tags:
  - cloud
  - cloud-strategy
  - architecture
type: concept
status: growing
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Modelo que combina nuvem privada e pública num arranjo coordenado por políticas, para cobrir o que nenhum dos dois entrega sozinho.

## Conceito

> [!quote] Definição do Gartner
> "Hybrid cloud computing refere-se ao provisionamento, uso e gestão de serviços de forma coordenada e baseada em políticas, através de uma mistura de serviços de nuvem internos e externos."

O híbrido não nasce de preferência arquitetural — nasce de restrição. Nem todo workload pode ir para o público (compliance, residência de dado, requisito de hardware); nem todo workload compensa manter no privado (picos ocasionais, licenciamento, presença geográfica).

## Comparação

| | Privado puro | Público puro | Híbrido |
|---|---|---|---|
| Controle do hardware | Total | Nenhum | Onde importa |
| Elasticidade | Limitada pela capacidade | Praticamente infinita | Base fixa + estouro |
| Custo | CapEx previsível | OpEx variável | Misto |
| Residência de dado | Sob controle | Sob política do provedor | Por classificação |
| Complexidade operacional | Média | Baixa | **Alta** |

## Características

Cinco vantagens que motivam a adoção:

| Vantagem | Como se realiza |
|---|---|
| **Eficiência de custo** | Utilização estável no privado, picos terceirizados. PoCs e testes no privado, onde o desperdício é visível |
| **Governança** | Dado sob regra de residência fica onde precisa ficar |
| **Livre de lock-in** | Containerização dá portabilidade entre provedores |
| **Resiliência** | Aplicação crítica nos dois mundos; se uma AZ privada cai, o público assume |
| **Escalabilidade** | [[Cloud Bursting]] para picos que excedem a capacidade privada |

Três condições para funcionar:

1. O workload precisa ser **projetado para rodar** nos dois ambientes.
2. **Mobilidade de dado** decidida explicitamente — o que pode ficar onde.
3. **Compatibilidade de API**. Stacks equivalentes são simples de combinar; motores de banco ou hipervisores diferentes elevam a complexidade.

> [!warning] O dado é o risco maior
> Dado circulando entre infraestruturas exige controles adicionais. Movimentação imprópria gera vazamento — e vazamento não se desfaz.

## Veja também

- [[Multi-Cloud]]
- [[Cloud Bursting]]
- [[Shared Responsibility Model]]
- [[Cloud Management Platform (CMP)]]
- [[Vendor Lock-in]]
