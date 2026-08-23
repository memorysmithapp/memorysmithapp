---
title: Kolla-Ansible
aliases:
  - Kolla
  - OpenStack Kolla
tags:
  - openstack
  - deployment
  - infrastructure-as-code
  - containers
  - ansible
type: concept
status: evergreen
source: Mastering OpenStack (3rd Edition), Packt, 2024
author: Omar Khedher
created: 2026-07-25
---
> [!abstract]
> Ferramenta oficial de implantação do OpenStack: constrói um container Docker por serviço e os orquestra com playbooks Ansible.

## Conceito

Subprojeto oficial desde o release **Liberty**. Missão declarada: *"prover containers production-ready e ferramentas de implantação para operar nuvens OpenStack"*.

Resolve o problema que sempre travou a operação do OpenStack: **o inferno de dependências entre serviços**. Upgrade de release era bloqueador porque não havia rollback barato em bare metal ou VM. Com container, o artefato é a imagem — versionada, portátil, descartável e promovível entre ambientes.

## Estrutura

Três níveis de configuração, do genérico ao específico:

| Nível | Arquivo | Escopo |
|---|---|---|
| 1 | `/etc/kolla/globals.yml` | Hub central de alto nível |
| 2 | `ansible/group_vars/all.yml` | Defaults por serviço; o que não está no globals vem daqui |
| 3 | `ansible/roles/<serviço>/defaults/main.yml` | Ajuste fino |

Sobrescrita por host: arquivos em `/etc/kolla/config/<serviço>/<HOSTNAME>/` são mesclados com o global — é assim que uma fazenda heterogênea convive.

Arquivos essenciais:

- `globals.yml` — distro base, interfaces, VIP, registry, quais serviços habilitar.
- `passwords.yml` — todos os segredos, populado por `kolla-genpwd`.
- `inventory` — grupos de host Ansible. **É a fonte da verdade de qual serviço roda onde.**

A sintaxe `[serviço:children]` dá a granularidade; sem declaração explícita, o serviço cai no grupo `control`.

## Características

- **Jinja2** parametriza os Dockerfiles, permitindo a mesma imagem sobre CentOS, Debian, Fedora, Ubuntu ou RHEL.
- Topologia **all-in-one** e **multi-node** com o mesmo código.
- Ciclo: `bootstrap-servers` → `prechecks` → `deploy` → `post-deploy`.
- Alternativa citada: **OSA (OpenStack-Ansible)**, que usa LXC em vez de Docker.

> [!info] Vem desligado por padrão
> Cinder, Swift, Manila, Ceilometer, Aodh, Magnum, Zun, Octavia, Masakari e Watcher não são habilitados automaticamente. Horizon vem, junto do `enable_openstack_core`.

## Veja também

- [[Infrastructure as Code]]
- [[Pipeline de CI-CD]]
- [[Immutable Infrastructure]]
- [[OpenStack]]
