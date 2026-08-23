---
title: DNS Routing Policy
aliases:
  - Política de Roteamento DNS
  - Internet Traffic Routing Policy
tags:
  - networking
  - distributed-systems
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> DNS Routing Policy é a regra que determina qual endereço será devolvido em uma consulta DNS, transformando a resolução de nomes em um mecanismo de distribuição de tráfego global.

## Conceito

O DNS costuma ser tratado como uma tabela estática de nome para IP, mas a resposta pode depender de quem perguntou, de onde perguntou e do estado dos destinos. É o ponto de controle mais barato para distribuir tráfego entre regiões — e o mais grosseiro, porque o cliente e os resolvedores intermediários fazem cache da resposta.

## Políticas

| Política | Critério da resposta |
|---|---|
| **Simple** | Sempre o mesmo endpoint, sem condição |
| **Failover** | Endpoint primário; muda para o secundário se o primário estiver indisponível |
| **Geolocation** | Localização geográfica de quem consultou |
| **Latency** | Endpoint com a menor latência medida para aquele solicitante |
| **Multivalue answer** | Devolve vários IPs e deixa o cliente escolher |
| **Weighted** | Distribuição proporcional aos pesos configurados |

```mermaid
flowchart TD
    Q[Consulta DNS] --> P{Política}
    P -->|Geolocation| R1[Endpoint regional]
    P -->|Latency| R2[Endpoint mais rápido]
    P -->|Failover| R3[Primário ou secundário]
    P -->|Weighted| R4[Distribuição proporcional]
```

> [!warning]
> Multivalue answer **não substitui** um [[Load Balancer]]: não há health check por conexão, não há algoritmo de distribuição e o TTL faz o cliente insistir em um endereço morto até a expiração.

## Veja também

- [[Load Balancer]]
- [[Content Delivery Network (CDN)]]
- [[High Availability]]
- [[Disaster Recovery]]
- [[Latency Numbers]]
