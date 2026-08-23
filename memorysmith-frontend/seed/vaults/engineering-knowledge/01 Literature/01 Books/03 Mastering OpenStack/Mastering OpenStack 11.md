---
title: Mastering OpenStack 11
aliases:
  - "Capítulo 11: A Hybrid Cloud Hyperscale Use Case – Scaling a Kubernetes Workload"
tags:
  - openstack
  - kubernetes
  - hybrid-cloud
  - federation
  - aws
  - cloud-agnostic
type: literature
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
chapter: 11
---
## Resumo executivo

O capítulo de fechamento é um estudo de caso ponta a ponta: **um workload Kubernetes atravessando OpenStack privado e AWS público**. Começa pelo pré-requisito (conectividade e stack agnóstica), revisita o vocabulário Kubernetes, apresenta os **dois modelos de desenho** — descentralizado (bursting) e centralizado (federação) — e implementa o segundo com **Juju** e **KubeFed**.

A conclusão prática: containerização é o que torna o híbrido viável. Sem ela, mover workload entre nuvens é projeto; com ela, é configuração.

## Principais ideias

- **Agnosticismo se projeta na arquitetura, não na migração.** Começa com microsserviços — módulos menores e independentes, testáveis e implantáveis separadamente.
- **Orquestração de container sem IaC vale pouco.** Cada provedor tem seu templating (CloudFormation, Cloud Deployment Manager, Deployment Manager, Heat) e a sintaxe é o lock-in. Ferramentas de terceiros (Terraform, Pulumi) abstraem a camada de infraestrutura.
- **A conexão de rede é o primeiro problema, não o último.** VPN é rápida mas limitada; DirectConnect é estável mas exige processo. A escolha define o teto de tudo que vem depois.
- **Descentralizado × centralizado é uma questão de onde vive o controle.** No primeiro, cada cluster é operado individualmente. No segundo, um host cluster propaga a configuração a todos os membros.
- **Federação remove a necessidade de manter estado por cluster.** Uma origem única de deployment atinge todos os clusters conectados, com a visão de um único cluster alvo.

## Conceitos apresentados

### Conectividade híbrida OpenStack ↔ AWS

| Tipo | Como | Banda | Trade-off |
|---|---|---|---|
| **Site-to-site VPN** | Túnel IPSec sobre a internet. Neutron oferece **VPNaaS**; AWS oferece VPN gateway + customer gateway | Até **1,25 Gbps por túnel** na AWS; no Azure, 100 Mbps a 10 Gbps conforme o tamanho do gateway | Mais rápido de montar, mas performance limitada e consistência não garantida (caminho longo por dispositivos compartilhados) |
| **DirectConnect** | Conexão dedicada e isolada. Duas modalidades: **hosted** (parceiro AWS cuida do físico) e dedicada | Alta e estável | Mais passos de implantação e custo maior |

> [!info] Redundância na VPN da AWS
> Uma conexão site-to-site cria **dois túneis**, cada um terminando em uma AZ diferente. Se um cai, o tráfego migra automaticamente para o outro.

> [!tip] O compromisso recomendado
> **DirectConnect com VPN de backup.** Se o link dedicado falha, o tráfego passa pela VPN. Alta disponibilidade a preço justo. Para produção crítica: dois DirectConnect — resiliência máxima, conta maior. A AWS recomenda **roteamento dinâmico** para failover automático, o que exige que o endpoint OpenStack suporte roteamento dinâmico e auto-failover.

No lado OpenStack, o Neutron provisiona um appliance virtual com limite de banda; o recurso de **QoS** permite políticas de controle de banda.

### Kubernetes — o vocabulário mínimo

**Master node:**

| Processo | Papel |
|---|---|
| `kube-scheduler` | Coloca containers nos hosts conforme disponibilidade e carga |
| `kube-controller-manager` | Vigia as atividades do cluster |
| `kube-apiserver` | Comunicação entre cliente e cluster; é por onde se alcança o master |
| `etcd` | Key-value store com o estado do cluster |

**Worker node:** `kubelet` (intercomunicação do cluster e gestão de containers, escutando o API server) e `kube-proxy` (rede entre serviços).

**Objetos:**

| Objeto | Definição |
|---|---|
| **Pod** | Menor componente. Combina containers, anexa storage e recebe um IP único |
| **Controller** | Gerencia criação, deleção, replicação e rollout de pods. Tipos: ReplicaSet, StatefulSet, DaemonSet, Deployment, Job, CronJob |
| **Service** | Expõe a aplicação de um ou mais pods; roteia requisições e oferece DNS e balanceamento |
| **Namespace** | Camada lógica de escopo que isola nomes e evita colisão |
| **Volume** | Storage persistente para o workload |

### Modelo descentralizado (bursting)

Adotado para evitar superprovisionamento da nuvem privada. Exige definir DNS, endpoint da API do cluster e configuração de namespace para que os recursos públicos operem no mesmo contexto de aplicação.

> [!warning] Consistência é o custo escondido
> Os dois clusters precisam estar alinhados em **configuração, gestão de identidade e deployments**. E o storage precisa ter o mesmo dado nos dois lados — sincronizado, por exemplo, por AWS DataSync de um volume no OpenStack para um **EFS** na VPC.

**EKS × Fargate:**

| Use **EKS** quando precisar de… | Use **Fargate** quando **não** quiser… |
|---|---|
| Cluster gerenciado sem operar o control plane | Provisionar a infraestrutura Kubernetes |
| Flexibilidade em rede, storage e escala | Gerenciar workload provisionando EC2 (usa task definitions) |
| Workloads complexos e grandes | Dimensionar por cluster e instância (usa CPU e RAM necessários) |
| Controle sobre deploy cross-region, on-prem, privado e público | Se preocupar com os nós do cluster |
| Integração com Elastic Load Balancing, App Mesh | Recursos extras do engine Kubernetes |

Para setup agnóstico com customização de rede, **EKS** é a escolha.

> [!info] Provisionamento de volume
> EFS pode ser montado no Fargate, mas **só com provisionamento estático**. Com nós EKS é possível **provisionamento dinâmico** de persistent volume.

#### Virtual Kubelet e KIP

O **kubelet** é o agente que coordena control plane e containers no nó. A CNCF criou o **Virtual Kubelet** — *"uma implementação open source do kubelet que se disfarça de kubelet"*. Sobre ele, o **KIP** (Kubernetes Cloud Instance Provider) permite gerenciar pods em instâncias de nuvem por uma interface única — o que viabiliza bursting de OpenStack para AWS.

### Modelo centralizado (KubeFed)

**Kubernetes Federation** consolida clusters do privado e do público sob um control plane comum.

- Uma **origem única** de deployment aplicada ao **host cluster** alcança todos os clusters conectados.
- Do ponto de vista do host, todos os demais são **member clusters**; cada aplicação implantada tem réplicas em todos os worker nodes, em escala.
- **DNS é gerenciado automaticamente** para todos os nós descobertos.
- Configuração específica de member cluster (ex.: políticas de rede locais) é suplementada pelo host cluster.
- Os pods de federação são pods comuns, vivendo num federated service, e cuidam de deployment de serviço, health monitoring e gestão de DNS.

### Juju

Ferramenta da Canonical para orquestração multi-nuvem. Arquitetura comparável a Puppet: o **Juju client** é o slave, o **Juju cloud controller** (um por ambiente) é o master. Os scripts se chamam **charms** — análogos aos manifests do Puppet e aos cookbooks do Chef — e implantam aplicações em container, VM ou bare metal, escritos em várias linguagens.

O charm `charmed-kubernetes` entrega um cluster production-grade com: master node, slave node, autoridade certificadora, **etcd**, load balancer da API, **containerd** e rede virtual com **Calico**.

## Exemplos

### Os sete passos do deployment híbrido

1. Instalar o Juju client no host deployer.
2. Configurar o client para bootstrap de AWS e OpenStack.
3. Implantar o Juju cloud controller na AWS.
4. Implantar o Juju cloud controller no OpenStack.
5. Implantar os clusters Kubernetes nas duas nuvens.
6. Conectar os dois clusters.
7. Configurar a federação.

### Bootstrap dos dois ambientes

```bash
brew install juju
juju list-clouds --all          # só lista nuvens públicas

# AWS — exige IAM user com acesso programático
juju add-credential aws         # access key + secret key
juju bootstrap aws juju-controller       # cria uma EC2 (default m7g.medium)
juju list-controllers

# OpenStack — precisa ser adicionado manualmente
juju add-cloud
juju add-credential awesome-openstack
juju bootstrap awesome-openstack juju-controller2
```

> [!warning] Menor privilégio
> O livro anexa `AmazonEC2FullAccess` ao usuário Juju "por simplicidade" e imediatamente adverte: em produção, políticas customizadas restringindo ações e recursos, sempre pelo princípio do menor privilégio.

### Deploy dos clusters e dashboard

```bash
juju deploy charmed-kubernetes                       # na AWS
juju deploy charmed-kubernetes -m juju-controller2   # no OpenStack
juju status -m juju-controller2                      # pronto quando todos os agentes = idle
watch -c juju status                                 # visão em tempo real

# dashboard (Juju 3.0+ exige o charm explicitamente)
juju switch juju-controller
juju deploy juju-dashboard-k8s dashboard
juju integrate dashboard juju-controller
juju expose dashboard
```

### Centralizando o acesso aos dois clusters

```bash
mkdir -p ~/.kube

juju switch aws
juju scp kubernetes-master/0:config ~/.kube/aws-config

juju switch awesome-openstack
juju scp kubernetes-master/0:config ~/.kube/os-config

kubectl cluster-info --kubeconfig=~/.kube/aws-config
kubectl config get-clusters
```

A prática recomendada: **mesclar todos os arquivos de config num só** — o `kubectl` recente gerencia múltiplos contextos, o que elimina o overhead de alternar entre clusters.

### Federação com KubeFed

```bash
# 1. cluster host da federação, no OpenStack
juju switch awesome-openstack
juju deploy charmed-kubernetes -m juju-controller-fed
juju scp kubernetes-master/0:config ~/.kube/fed-config

# 2. provedor de DNS — CoreDNS
juju switch juju-controller-fed
juju config kubernetes-master enable-coredns=True
```

```ini
# coredns-provider.conf
[Global]
etcd-endpoints = http://10.0.0.54:2379
zones = kube-fed.com.
```

```bash
# 3. instalação do kubefedctl
curl -LO https://github.com/kubernetes-sigs/kubefed/releases/download/v0.10.0/kubefedctl-0.10.0-darwin-amd64.tgz
tar -xzvf kubefedctl-0.10.0-darwin-amd64.tgz
sudo cp kubernetes/client/bin/kubefed /usr/local/bin && sudo chmod +x /usr/local/bin/kubefed

# 4. inicialização do control plane federado
kubefed init hybridfed --host-cluster-context=juju-controller-fed \
  --dns-provider="coredns" --dns-zone-name="kube-fed.com" \
  --dns-provider-config=coredns-provider.conf

# 5. junção dos clusters
kubectl config use-context hybridfed
kubefed join aws               --host-cluster-context=juju-controller-fed
kubefed join awesome-openstack --host-cluster-context=juju-controller-fed
kubectl get clusters
```

`kubefed init` instala um novo API server expondo o serviço de federação, o controller manager e um namespace dedicado, `federation-system`, no host cluster.

> [!info] DNS automático no provedor nativo
> Se o federated service controller roda na AWS com uma hosted zone do Route 53 pré-configurada, a configuração de DNS é gerada automaticamente. No OpenStack é preciso declarar o provedor — daí o CoreDNS.

### A prova: um namespace federado

```yaml
# fed-ns.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fed-ns
```

```bash
kubectl --context=hybridfed create -f fed-ns.yaml

kubectl --context=aws               get ns    # fed-ns aparece
kubectl --context=awesome-openstack get ns    # fed-ns aparece
```

Uma criação, dois ambientes. A partir daí, serviços e pods seguem o mesmo caminho: criados no contexto federado, propagados pelo controller às nuvens privada e pública.

---
Ref: [[Mastering OpenStack]], [[Mastering OpenStack 10]], [[Kubernetes (K8s)]], [[Kubernetes Federation]], [[Hybrid Cloud]], [[Cloud Bursting]], [[Kubernetes Federation]], [[Cloud Bursting]], [[Infrastructure as Code]], [[Microservices]]
