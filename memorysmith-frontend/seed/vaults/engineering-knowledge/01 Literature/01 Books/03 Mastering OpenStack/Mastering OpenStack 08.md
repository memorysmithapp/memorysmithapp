---
title: Mastering OpenStack 08
aliases:
  - "Capítulo 8: Monitoring and Logging – Remediating Proactively"
tags:
  - openstack
  - observability
  - monitoring
  - logging
  - prometheus
  - telemetry
type: literature
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
chapter: 8
---
## Resumo executivo

Duas disciplinas operacionais, tratadas juntas porque nenhuma basta sozinha: **métricas** (Prometheus + Grafana para a infraestrutura; Ceilometer + Gnocchi + Aodh para o workload e o chargeback) e **logs** (OpenSearch como pipeline centralizado).

A separação que estrutura o capítulo: **monitorar a nuvem** (APIs, schedulers, banco, fila, balanceador) é diferente de **monitorar sob a nuvem** (SO, storage, hardware de rede) — e ambas são diferentes de **monitorar o que o tenant roda em cima**.

## Principais ideias

- **Exporters são o padrão de integração do Prometheus.** Em vez de escrever um conversor para cada sistema, instala-se um exporter que já fala o formato. É o que torna a instrumentação do OpenStack barata.
- **A telemetria do OpenStack nasceu para faturar, não para monitorar.** Até o Folsom, o Ceilometer só coletava métricas de uso de tenant para transformá-las em itens de fatura. Monitoramento e alarme foram acoplados depois — e desacoplados de novo, em módulos próprios, desde o Liberty.
- **Métrica bruta não escala; série temporal indexada sim.** MongoDB era o data store original e travou por performance. Gnocchi resolveu convertendo amostras em pontos com timestamp, **indexando recursos e atributos** e delegando o armazenamento a Swift ou Ceph.
- **Log estruturado é o que torna o pipeline possível.** Os logs do OpenStack são estruturados — daí serem parseáveis por ELK, OpenSearch, Datadog ou Splunk.
- **OpenSearch é a nova aposta.** Fork open source do Elasticsearch (Apache 2.0), com search engine, data store e dashboards derivados do Kibana.
- **Um só servidor Prometheus não basta em escala.** Mais nós = mais métricas = pressão de disco e CPU no host de monitoramento. O autor recomenda múltiplas instâncias.

## Conceitos apresentados

### Os exporters do Prometheus no OpenStack

| Exporter | Onde roda | O que expõe |
|---|---|---|
| **OpenStack exporter** | Monitoring | Métricas dos serviços OpenStack via API |
| **Node exporter** | Todos os nós | Métricas de SO e hardware |
| **MySQLd exporter** | Grupo `mariadb` | Métricas do servidor MySQL/MariaDB |
| **HAProxy exporter** | Load balancers | Stats de balanceamento |
| **Libvirt exporter** | Compute | Métricas do host e das **instâncias**, colhidas da API do Libvirt |
| **cAdvisor** | Todos os nós | Performance dos containers |

Complementado pelo **Alertmanager** (built-in) e pelo **serviço de descoberta**, que consulta a API do OpenStack para gerar alvos de scraping — útil para instâncias.

> [!tip] Relabeling é o que dá sentido às métricas de instância
> Aplicando a expressão `__meta_openstack_(.+)` na configuração de relabeling, os metadados descobertos (nome da instância, IP, status) viram labels. Sem isso, você tem milhares de alvos anônimos.

### Telemetria — o trio Ceilometer / Gnocchi / Aodh

#### Ceilometer — os quatro tipos de agente

| Agente | Papel |
|---|---|
| **Polling** | Consulta periodicamente cada serviço via API. O agente de compute colhe estatísticas das instâncias; o central colhe dos demais recursos |
| **Notification** | Escuta o barramento de mensagens, captura notificações dos serviços e as traduz em métricas |
| **Collector** | Vigia a fila, junta as amostras e grava no storage de backend |
| **API service** | Expõe o acesso de consulta ao banco interno do Ceilometer |

#### Pipeline de transformação

Toda amostra passa por um pipeline antes de ser publicada:

| Transformer | O que faz |
|---|---|
| **Accumulator** | Acumula múltiplos valores e envia em lote |
| **Aggregator** | Agrega múltiplos valores em uma aritmética (inclusive percentuais) |
| **Rate of change** | Deriva uma nova métrica a partir do dado anterior — identifica tendências |
| **Unit conversion** | Converte unidade |

E é publicada por um **publisher**: `notifier` (fila confiável), `rpc` (síncrono), entre outros.

#### Gnocchi

Padrão oficial de storage do Ceilometer desde o **Train**. Amostras não vão direto ao banco: viram elementos Gnocchi postados na API nativa, e os dados agregados são gravados como série temporal. O daemon **`metricd`** cuida da agregação, do armazenamento e da limpeza de métricas marcadas para deleção. O **`gnocchi-statsd`** implementa o protocolo statsd para métricas de entrada.

#### Aodh

Fork do módulo de alarme do Ceilometer desde o Liberty. Diferencial: **escala horizontalmente** e responde a eventos com latência zero, via listener no mesmo barramento.

| Componente | Papel |
|---|---|
| `aodh-api` | Acesso ao data store |
| `aodh-evaluator` | Dispara alarme quando a tendência estatística cruza um limiar no período |
| `aodh-listener` | Dispara alarme por regra sobre eventos reportados pelos agentes de notificação |
| `aodh-notifier` | Alarme baseado em limiar sobre uma coleção de amostras |

Suporta alarmes **por evento** e **por limiar**; consulta medições do Gnocchi por padrão.

> [!info] Panko foi depreciado
> O quarto módulo da telemetria — data store para os eventos gerados pelo Ceilometer — não é mais mantido pela comunidade.

### OpenSearch — papéis de nó no cluster

| Papel | Função |
|---|---|
| **Cluster manager** | Rastreia o estado do cluster: entradas e saídas de nó, saúde, gestão de índice, alocação de shard. **Mínimo de dois em produção** |
| **Coordinator** | Recebe requisições do dashboard/cliente, delega ao shard certo, agrega e devolve o resultado |
| **Data node** | Cavalo de batalha: armazena os dados e executa indexação, agregação e busca |
| Master-eligible | Qualquer nó não marcado como master |
| Ingest | Recomendado em pipelines pesados de ingestão, para tirar a carga de indexação dos data nodes |

> [!tip] Dimensione por papel, não por uniformidade
> Data nodes pedem **disco rápido e IOPS alto** (SSD). Master e coordinator pedem **CPU**. Tratá-los como nós idênticos é desperdício nos dois sentidos.

#### Retenção em duas fases

| Período | Variável | Padrão | O que acontece |
|---|---|---:|---|
| **Soft** | `opensearch_soft_retention_period_days` | 30 | Índice é fechado e deixa de ser ativo, mas ainda ocupa disco e pode ser reaberto |
| **Hard** | `opensearch_hard_retention_period_days` | 60 | Índice é apagado permanentemente |

Controlado pelo plugin **Index State Management**, ativado por `opensearch_apply_log_retention_policy: true`.

## Exemplos

### Inventário do stack de monitoramento

```ini
[monitoring]
mon01.os.packtpub

[prometheus:children]
monitoring
[prometheus-alertmanager:children]
monitoring
[prometheus-openstack-exporter:children]
monitoring

[prometheus-node-exporter:children]
monitoring
control
compute
network
storage

[prometheus-mysqld-exporter:children]
mariadb
[prometheus-haproxy-exporter:children]
loadbalancer
[prometheus-libvirt-exporter:children]
compute

[prometheus-cadvisor:children]
monitoring
control
compute
network
storage
```

```yaml
# globals.yml
enable_prometheus: "yes"
enable_grafana: "yes"
prometheus_cmdline_extras: " --web.max-connections 30 --log.level error --rules.alert.resend-delay 30s --storage.tsdb.retention.time 30d "
```

Portas: Prometheus em `/prometheus` no host de monitoramento, alvos em `:9090/targets`, métricas em `:9100/metrics`, Grafana em `:3000`.

### Dashboards prontos do Grafana

| Dashboard | ID |
|---|---:|
| OpenStack | 9701 |
| Node Exporter Full | 1860 |
| MySQL | 14057 |
| HAProxy | 2428 |

O dashboard 9701 já entrega usuários/grupos/projetos do Keystone, floating IPs e security groups do Neutron, instâncias do Nova, imagens do Glance, volumes e snapshots do Cinder, e o uso agregado de CPU, RAM e disco.

### Inventário da telemetria

```ini
[ceilometer:children]
control
[ceilometer-central:children]
ceilometer
[ceilometer-notification:children]
ceilometer
[ceilometer-compute:children]
compute

[gnocchi:children]
control
[gnocchi-api:children]
gnocchi
[gnocchi-statsd:children]
gnocchi
[gnocchi-metricd:children]
gnocchi

[aodh:children]
control
[aodh-api:children]
aodh
[aodh-evaluator:children]
aodh
[aodh-listener:children]
aodh
[aodh-notifier:children]
aodh
```

```yaml
enable_ceilometer: "yes"
enable_gnocchi: "yes"
enable_gnocchi_statsd: "yes"
enable_aodh: "yes"
```

### Logging centralizado

```ini
[opensearch:children]
control
[opensearch-dashboards:children]
opensearch
```

```yaml
enable_central_logging: "yes"
kolla_internal_vip_address: "10.0.0.47"
```

Engine na porta **9200**, dashboards na **5601**, acessíveis pelo VIP do Keepalived. Usuário padrão: `opensearch`.

Fluxo de uso no dashboard: criar **index pattern** (filtrando por `timestamp`) → explorar no **Discover** → filtrar (ex.: `log_level: ERROR`) → **Visualize** com bar chart e bucket no eixo X do tipo *Date Histogram* sobre `@timestamp`.

> [!info] Por que OpenSearch e não ELK
> ELK segue válido e é suportado nativamente pela maioria das ferramentas de deploy do OpenStack — mas não pelo `kolla-ansible`, que adotou o fork. A mudança é de licenciamento e comunidade, não de capacidade.

---
Ref: [[Mastering OpenStack]], [[Mastering OpenStack 07]], [[Mastering OpenStack 09]], [[Observability]], [[Observability]], [[Metrics]], [[Ceilometer]], [[Gnocchi]], [[Aodh]], [[Centralized Logging]], [[Time Series Database]], [[Centralized Logging]]
