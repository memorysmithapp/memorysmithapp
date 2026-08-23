---
title: Latency Numbers
aliases:
  - Números de Latência
  - Latency Numbers Every Programmer Should Know
tags:
  - performance
  - distributed-systems
  - system-design
type: concept
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> Latency Numbers é o conjunto de ordens de grandeza das operações mais comuns de um sistema — da cache L1 à travessia intercontinental — usado como régua para avaliar qualquer decisão de arquitetura.

## Conceito

Arquitetura é escolha entre onde o dado mora e quanto custa alcançá-lo. Sem internalizar que existem **seis ordens de grandeza** entre ler da memória e cruzar o Atlântico, a discussão sobre cache, réplica ou colocação geográfica vira opinião. Os números abaixo, derivados dos *latency numbers* de Jeff Dean, não são precisos — são a escala relativa que importa.

## A escala

| Operação | Ordem de grandeza | Exemplo prático |
|---|---:|---|
| Cache L1 | 1 ns | Dentro do processador |
| Cache L2 | 10 ns | Dentro do processador |
| Acesso à RAM | 100 ns | Leitura no Redis, que é in-memory |
| Enviar 1 KB por rede de 1 Gbps | 10 µs | Leitura no Memcached pela rede |
| Leitura em SSD | 100 µs | RocksDB, que é disk-based |
| Insert em banco de dados | 1 ms | Commit no PostgreSQL — grava, indexa e faz flush do log |
| Pacote Califórnia → Holanda → Califórnia | 100 ms | Latência de uma chamada de vídeo intercontinental |
| Intervalo de retry / refresh | 1–10 s | Refresh padrão de um painel Grafana |

```text
1 ns = 10⁻⁹ s   ·   1 µs = 1.000 ns   ·   1 ms = 1.000 µs = 1.000.000 ns
```

## Leituras que derivam daqui

- **Memória é ~1.000× mais rápida que SSD**, e é por isso que [[Distributed Cache]] muda o comportamento de um sistema, não apenas o afina
- **Rede local é ~100× mais rápida que rede intercontinental**, o que justifica [[Content Delivery Network (CDN)]] e replicação regional
- **Uma chamada de rede a mais no caminho crítico** custa mais que centenas de operações em memória — é o argumento contra decomposição excessiva em [[Microservices]]

## Veja também

- [[TCP]]
- [[Modelo OSI]]

- [[Distributed Cache]]
- [[Content Delivery Network (CDN)]]
- [[Database Index]]
- [[Estratégias de Cache]]
- [[Microservices]]
