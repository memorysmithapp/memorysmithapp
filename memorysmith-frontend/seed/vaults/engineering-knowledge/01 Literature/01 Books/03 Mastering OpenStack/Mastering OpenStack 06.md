---
title: Mastering OpenStack 06
aliases:
  - "Capítulo 6: OpenStack Networking – Connectivity and Managed Service Options"
tags:
  - openstack
  - neutron
  - sdn
  - networking
  - open-vswitch
  - load-balancing
type: literature
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
chapter: 6
---
## Resumo executivo

O capítulo percorre o serviço mais complexo do ecossistema. Estrutura: **arquitetura do Neutron** (server + agentes) → **plugins** (core ML2 e service plugins) → **type drivers × mechanism drivers** → as duas implementações de comutação virtual (**[[Open vSwitch (OVS)]]** e **[[Open Virtual Network (OVN)]]**) → **roteamento** (namespaces, NAT/SNAT/DNAT, floating IP, BGP dinâmico) → **LBaaS com [[Octavia]]**.

A mensagem de projeto: o ML2 acabou com a era do plugin monolítico. Você não escolhe *uma* tecnologia de rede — combina várias, simultaneamente.

## Principais ideias

- **Neutron nasceu para desamarrar a rede da computação.** O antigo `nova-network` só fazia o básico e vivia dentro do Nova. Neutron dá ao tenant controle granular: rotas, firewall, load balancer, redes privadas.
- **ML2 = type drivers × mechanism drivers.** O type driver diz *como o tráfego é segmentado* (VLAN, VXLAN, GRE, GENEVE, flat, local); o mechanism driver diz *quem implementa* (OVS, Linux Bridge, OVN, VMware, Cisco, OpenDaylight). Trocar de tunelamento em produção é instalar um driver e reconfigurar a lista.
- **OVN desacopla controle de encaminhamento; OVS não.** Essa é a diferença que importa — OVN é a implementação madura da filosofia [[Software-Defined Networking (SDN)]], com regras de fluxo programáveis centralmente.
- **Roteador virtual é namespace de rede.** Cada roteador vira um `qrouter-<uuid>` com tabelas de rota, forwarding e regras iptables próprias, e duas classes de interface: `qr` (interno) e `qg` (externo).
- **Floating IP é DNAT; acesso à internet é SNAT.** A mesma instância usa mecanismos opostos para sair e para ser alcançada.
- **BGP dinâmico elimina a necessidade de floating IP.** A rede do tenant se anuncia sozinha ao roteador físico, sem depender do administrador de rede.

> [!warning] Roteador standalone é ponto único de falha
> O capítulo levanta e adia: HA de roteador virtual fica para o Capítulo 7.

## Conceitos apresentados

### Componentes do Neutron

| Componente | Onde | Papel |
|---|---|---|
| **Neutron server** | Controller | Portal de API; encaminha aos agentes pela fila e atualiza os objetos de rede no banco |
| **Agente L2** (`neutron-*-agent`) | Compute e network | Comutação virtual; conectividade L2 via mechanism driver do ML2 |
| **Agente L3** (`neutron-l3-agent`) | Network (opcionalmente compute) | Roteamento entre redes tenant e externas; NAT, firewall, VPN |
| **Agente DHCP** (`neutron-dhcp-agent`) | Network | Serviço DHCP por rede tenant (via `dnsmasq`) |
| **Agente de metadados** | Network/compute | Serve metadados às instâncias |

### Categorias de rede

| Categoria | Quem cria | Característica |
|---|---|---|
| **Provider network** | Operador da nuvem | Define tipo (VXLAN, GRE, flat) e a interface física do tráfego |
| **Self-service (tenant) network** | Usuário da nuvem | Autocontida e isolada; o usuário só pode usar os tipos que o operador liberou |
| **External provider network** | Operador | Provider network com dispositivo de roteamento externo para a internet |

### Os dois tipos de plugin

- **Core plugin** — conectividade L2 e orquestração de redes, subnets e portas. Hoje é o **ML2**.
- **Service plugin** — capacidades adicionais: roteamento, VPN, firewall, load balancing.

#### Type drivers do ML2

| Type driver | Como segmenta |
|---|---|
| **VLAN** | Tagging 802.1Q; VMs da mesma VLAN compartilham o domínio de broadcast L2 |
| **VXLAN** | VNI (virtual network identifier) diferencia o tráfego entre redes |
| **GRE** | Encapsulamento por tunelamento GRE |
| **GENEVE** | Como o VXLAN, mas com encapsulamento extensível |
| **Flat** | Sem tagging nem segregação — todas as instâncias na mesma rede |
| **Local** | Só entre instâncias do mesmo nó de computação |

> [!important] GENEVE × VXLAN
> VXLAN codifica **apenas o VNI** no cabeçalho (8 bytes). GENEVE usa **TLV extensível** (cabeçalho de 38 bytes) e carrega mais informação — portas de ingresso e egresso, por exemplo. Isso habilita segurança de transporte, service chaining e telemetria in-band. É o tipo padrão do OVN.

### Open vSwitch — anatomia

| Processo | Papel |
|---|---|
| `openvswitch` | Módulo de kernel; data plane, processa os pacotes |
| `ovs-switchd` | Processo Linux que controla e gerencia os switches virtuais |
| `ovsdb-server` | Banco local dos switches virtuais |
| `neutron-openvswitch-agent` | Roda nos nós de computação com o mechanism driver OVS |

**Interfaces por onde um frame Ethernet viaja:**

```
instância → tapXXXX → qbrXXXX (Linux bridge) → br-int (integration bridge)
   ├─ mesmo nó?  → br-int → qrXXXX / tapYYYY (destino local)
   └─ outro nó?  → br-tun (encapsula VXLAN) → br-ethX/br-ex → rede física
```

- `br-int` — bridge de integração, consolida todos os dispositivos virtuais (VMs, roteadores, firewalls). O tráfego é roteado por regras **OpenFlow**.
- `br-tun` — encapsula e desencapsula pacotes; troca o VLAN ID local pelo tunnel ID VXLAN.
- `br-ex` — conectividade com redes externas.

Bridges de integração e de provider se conectam por **patch cables**.

### OVN — anatomia

Construído **sobre** o OVS, adicionando uma camada de abstração gerenciada por controladores, guardada em bancos OVSDB.

| Construto | Referência | Papel |
|---|---|---|
| **Northbound DB** | `ovnnb.db` | Visão de alto nível das redes virtuais do CMS (OpenStack). Tabelas `Logical_Router`, `Logical_Switch_Port` |
| **Southbound DB** | `ovnsb.db` | Ligação entre fluxos lógicos e físicos. Tabelas `Port_Binding`, `Logical_Flow` |
| **`ovn-northd`** | Control plane | Traduz a configuração lógica do NB em fluxos de datapath no SB |
| **`ovn-controller`** | Hipervisor | Converte fluxos lógicos em físicos e programa as regras OpenFlow no OVS local |
| **`ovs-vswitchd`** | Data plane | Aplica as regras de encaminhamento |
| **Local OVSDB** | Hipervisor | Snapshot consistente para recuperação |

**Roteamento L3 no OVN** tem dois modos:

| Modo | Comportamento |
|---|---|
| **Centralizado** | Todo tráfego passa pelo nó de rede. Sem floating IP distribuído |
| **DVR** (distributed virtual routing) | Agente L3 em cada nó de computação. Tráfego **norte-sul** (com floating IP) e **leste-oeste** roteado direto do compute, sem o salto extra ao nó de rede. **Recomendado** por performance |

### Roteamento e NAT

| Interface | Contém | Roteia |
|---|---|---|
| `qr` | IP do gateway da rede tenant | Tráfego entre redes self-service |
| `qg` | IP do gateway da rede externa | Tráfego para a provider network externa |

- **SNAT** — a instância alcança a internet traduzindo o IP de origem para o do roteador.
- **DNAT (floating IP)** — o roteador encaminha pacotes que chegam à interface externa para a instância de destino; o floating IP aparece como endereço secundário na interface `qg`.

### BGP dinâmico

Introduzido no **Mitaka**; suporte com OVN a partir do **Antelope**. Elementos:

- **BGP speaker** — faz o peering entre a rede tenant e o dispositivo roteador externo, e anuncia os prefixos.
- **Address scopes e subnet pools** — controlam a alocação de endereços para evitar sobreposição de IP no anúncio.

Requisito prático: conectividade direta entre o nó de rede e o gateway físico (peer LAN/WAN). Tenant e rede externa precisam estar no **mesmo address scope**.

### Octavia — LBaaS v2

Substituiu o plugin LBaaS v1 do Neutron desde o **Liberty**. Escala horizontalmente criando VMs balanceadoras chamadas **amphorae**. Vocabulário herdado do HAProxy:

| Termo | Definição |
|---|---|
| **VIP** | Objeto L4 associado a uma porta Neutron; expõe o serviço e distribui aos membros |
| **Pool** | Grupo de instâncias servindo o mesmo conteúdo |
| **Pool member** | Instância do pool: IP + porta de escuta |
| **Listener** | Porta associada ao VIP que escuta as requisições |

Componentes de controle: **Controller worker** (configura as amphorae), **API controller**, **Health manager** (vigia cada amphora e dispara failover) e **Housekeeping manager** (limpa registros obsoletos, gerencia o spare pool).

## Exemplos

### Habilitando OVS

```yaml
# globals.yml
neutron_external_interface: "eth2"      # aceita lista: "eth2,eth3"
neutron_plugin_agent: "openvswitch"
```

```ini
# inventory
[neutron-server:children]
control
[neutron-dhcp-agent:children]
neutron
[neutron-l3-agent:children]
neutron
[openvswitch:children]
network
compute
manila-share
```

Padrão do tenant network: **VXLAN**, com `vni_ranges` de 1 a 1000 no `ml2_config.ini`.

Diagnóstico: `ovs-vsctl list-br`, `ovs-vsctl show`, `openstack network agent list`.

### Habilitando OVN

```yaml
neutron_plugin_agent: "ovn"
neutron_ovn_distributed_fip: "yes"
neutron_enable_ovn_agent: "yes"
```

Resultando em `/etc/neutron/plugins/ml2/ml2_conf.ini`:

```ini
[ml2]
tenant_network_types = geneve
type_drivers = local,flat,vlan,geneve
mechanism_drivers = ovn

[ml2_type_geneve]
max_header_size = 38
vni_ranges = 1001:2000
```

Distribuição: `ovn-northd` e os dois bancos no controller; `ovn-controller` e `neutron-ovn-metadata-agent` nos nós de computação.

### Rede tenant + roteador + saída para a internet

```bash
# rede privada
openstack network create network_pp
openstack subnet create --subnet-range 10.10.0.0/24 --network network_pp \
  --dns-server 8.8.8.8 priv_subnet

# roteador
openstack router create router_pp
openstack router add subnet router_pp priv_subnet     # cria a interface qr-

# rede externa (VLAN, segment 40, physnet1)
openstack network create --external --provider-network-type vlan \
  --provider-segment 40 --provider-physical-network physnet1 external_pp
openstack subnet create --subnet-range 10.20.0.0/24 --no-dhcp \
  --network external_pp --allocation-pool start=10.20.0.10,end=10.20.0.100 pub_subnet

openstack router set --external-gateway external_pp router_pp   # cria a interface qg-

# security group
openstack security group create SG_pp
openstack security group rule create SG_pp --protocol tcp --dst-port 22
openstack security group rule create SG_pp --protocol icmp

# floating IP (DNAT)
openstack port list --server instance_pp
openstack floating ip create --port <port-id> external_pp
```

Inspeção do namespace: `ip netns` lista os `qrouter-<uuid>`; `ip netns exec qrouter-<uuid> ip addr show` mostra as interfaces `qr-` e `qg-`.

### Load balancer round-robin com Octavia

```bash
openstack loadbalancer create --name lb --vip-subnet-id priv-subnet
# aguardar PROVISIONING_STATUS = ACTIVE e OPERATING_STATUS = ONLINE

openstack loadbalancer listener create --name listener80 \
  --protocol TCP --protocol-port 80 lb

openstack loadbalancer pool create --name poolweb \
  --lb-algorithm ROUND_ROBIN --listener listener80 --protocol TCP

openstack loadbalancer healthmonitor create --name http-check \
  --delay 15 --max-retries 4 --timeout 30 --type HTTP poolweb

openstack loadbalancer member create --subnet-id private-subnet \
  --address 10.10.0.114 --protocol-port 80 poolweb
openstack loadbalancer member create --subnet-id private-subnet \
  --address 10.10.0.125 --protocol-port 80 poolweb
```

O deploy do Octavia exige `enable_neutron_provider_networks: true` (as amphorae conversam pela rede de gerência) e uma **imagem amphora** carregada no Glance.

---
Ref: [[Mastering OpenStack]], [[Mastering OpenStack 05]], [[Mastering OpenStack 07]], [[Neutron]], [[Open vSwitch (OVS)]], [[Open Virtual Network (OVN)]], [[Software-Defined Networking (SDN)]], [[Octavia]], [[VXLAN]], [[Floating IP]], [[NAT]], [[Border Gateway Protocol (BGP)]]
