---
title: ByteByteGo System Design Archive 02
aliases:
  - "Parte 2: Cloud Native, DevOps e Microsserviços"
tags:
  - cloud-native
  - devops
  - microservices
  - kubernetes
  - observability
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
chapter: 2
---
## Parte 2: Cloud Native, DevOps e Microsserviços

Reúne os tópicos do arquivo sobre **como o software é empacotado, entregue e operado**: contêineres, orquestração, pipeline de entrega, decomposição em serviços e os três pilares da observabilidade.

## Resumo executivo

Microsserviços não são uma topologia de código, são uma topologia de **times e de infraestrutura**. O arquivo mostra isso na prática: toda arquitetura de microsserviços apresentada carrega o mesmo conjunto de componentes de apoio — gateway, registry, identity provider, camada de gestão — que existem apenas porque o sistema foi decomposto. Docker resolve o empacotamento no host; Kubernetes resolve o mesmo problema no nível do cluster. Cloud Native é o guarda-chuva que descreve o espectro completo de adoção.

## Principais ideias

- **A diferença Docker × Kubernetes é o nível de operação.** Docker opera no host individual; Kubernetes opera no cluster, automatizando balanceamento, escala e reconciliação do estado desejado.
- **O plano de controle do Kubernetes é declarativo.** API Server, Scheduler, Controller Manager e etcd existem para reconciliar continuamente o estado real com o declarado — o que muda o modelo mental de "executar comandos" para "declarar intenção".
- **CI e CD respondem a perguntas diferentes.** CI automatiza build, teste e merge para detectar problemas de integração cedo; CD automatiza a liberação para que o software possa ir a produção de forma confiável a qualquer momento.
- **Adoção Cloud Native é um espectro de seis eixos**, não um interruptor: definição da aplicação, orquestração e gestão, runtime, provisionamento, observabilidade e serverless.
- **Os anti-padrões Cloud Native quase sempre são o padrão antigo mantido no ambiente novo** — monólito acoplado na nuvem, infraestrutura mutável, componentes com estado, pipeline manual.
- **Logs, traces e métricas não são intercambiáveis.** Logs são eventos discretos e volumosos; traces são *request-scoped* e revelam gargalos entre serviços; métricas são agregações em série temporal que sustentam alertas.

> [!quote]
> "There is no one-size-fits-all guide; it all depends on your specific needs, and picking the right stack is HARD."

## Conceitos apresentados

- [[Microservices]] — componentes de apoio, benefícios e custos
- [[Container]]
- [[Container Orchestration]]
- [[Kubernetes (K8s)]] — plano de controle, nós e os 4 tipos de Service
- [[Cloud Native]]
- [[Cloud Native Anti-Patterns]]
- [[Immutable Infrastructure]]
- [[Logging]]
- [[Distributed Tracing]]
- [[Pipeline de CI-CD]]
- [[Adoção Cloud Native]]

## Exemplos

- **Uber (CI/CD):** monorepo com Bazel, uBuild sobre Buildkite para empacotamento, Spinnaker (da Netflix) para deploy, SLATE para ambientes efêmeros de teste, Shadower para carga com replay de tráfego de produção.
- **Netflix:** stack de CI/CD que originou o Spinnaker, hoje adotado por terceiros.
- **Stack de observabilidade recorrente:** ELK para logs, OpenTelemetry para traces, InfluxDB + Prometheus + Grafana para métricas e alertas.

---
Ref: [[ByteByteGo System Design Archive]], [[DevOps]], [[Observability]], [[Infrastructure as Code]], [[System Design MOC]]
