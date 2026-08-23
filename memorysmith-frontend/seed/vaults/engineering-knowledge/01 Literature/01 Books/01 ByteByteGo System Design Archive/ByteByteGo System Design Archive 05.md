---
title: ByteByteGo System Design Archive 05
aliases:
  - "Parte 5: Redes e Sistema Operacional"
tags:
  - networking
  - operating-system
  - linux
  - computing
type: literature
status: evergreen
source: "BIG ARCHIVE: System Design 2023, ByteByteGo"
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
chapter: 5
---
## Parte 5: Redes e Sistema Operacional

Reúne os tópicos do arquivo sobre **o substrato** — as camadas de rede e de sistema operacional sobre as quais tudo o que foi extraído nas partes anteriores é executado.

## Resumo executivo

Esta é a parte em que o arquivo é mais raso: quase todo tópico é um diagrama com poucas linhas de texto, e o modelo OSI aparece como uma lista de sete nomes sem nenhuma explicação. Em compensação, é a parte que **fecha o raciocínio** das anteriores. Latência intercontinental, timeout logo após deploy, contêiner leve, sessão presa a uma instância, cache no edge — todos os fenômenos discutidos como decisões de arquitetura têm sua causa aqui embaixo.

O fio condutor é o mesmo do resto do arquivo: cada camada oferece uma abstração e cobra por ela. IP entrega o melhor esforço; TCP compra confiabilidade com latência; UDP devolve o troco quando a confiabilidade não vale o preço. Processo compra isolamento com custo de comunicação; thread faz o oposto.

## Principais ideias

- **O modelo OSI vale como ferramenta de diagnóstico**, não como descrição literal da internet — que roda sobre a pilha TCP/IP de quatro camadas.
- **A escolha entre TCP e UDP é sobre o que fazer com o dado atrasado.** Se ele ainda vale, TCP; se já não vale, UDP. QUIC é a reviravolta: reconstrói confiabilidade sobre UDP para escapar do *head-of-line blocking* do TCP.
- **DNS é o exemplo mais difundido de consistência eventual em produção** — o próprio arquivo faz essa ligação ao tratar de replicação.
- **URI é o gênero; URL e URN são espécies.** A URL localiza, a URN nomeia.
- **Proxy e reverse proxy são o mesmo mecanismo em direções opostas** — e o reverse proxy é o padrão comum por trás de load balancer, API gateway, CDN e service mesh.
- **O FHS existe desde 1994** para dar layout consistente entre distribuições. A separação entre `/usr` (estático) e `/var` (variável) antecipa o raciocínio de infraestrutura imutável.
- **A etapa 5 do boot — a passagem de kernel space para user space** — é o que explica por que contêiner sobe em segundos: ele não repete as quatro etapas anteriores.
- **Linguagem compilada roda mais rápido**, mas a classificação é da implementação, não da linguagem.

> [!quote]
> "Imagine the file system as a tree, starting from the root (/). With time, it will become second nature to you, transforming you into a skilled Linux administrator."

> [!warning] Limite desta parte da fonte
> Os tópicos de rede e SO do arquivo são quase inteiramente visuais. As notas extraídas apoiam-se em fontes primárias — RFCs da IETF, ISO/IEC 7498-1, FHS 3.0 da Linux Foundation, documentação da AWS — usando o arquivo apenas como mapa do que valia a pena documentar.

## Conceitos apresentados

- [[Modelo OSI]] — as sete camadas e a correspondência com TCP/IP
- [[TCP]] · [[UDP]] — garantias, handshake e o caso do QUIC
- [[DNS]] · [[URI, URL e URN]]
- [[Proxy]] · [[Reverse Proxy]]
- [[Virtual Private Cloud (VPC)]] · [[Subnet]] — componentes de rede em nuvem
- [[Processo (Computação)]] · [[Thread]]
- [[Processo de Boot do Linux]] · [[Filesystem Hierarchy Standard (FHS)]] · [[Comandos Linux Essenciais]]
- [[Linguagem Compilada e Interpretada]] · [[Estruturas de Dados]]

## Exemplos

- **Oito protocolos em um diagrama:** HTTP, HTTP/3, HTTPS, WebSocket, TCP, UDP, SMTP e FTP.
- **Monorepo × microrepo:** Google e Meta em monorepo com toolchain próprio (Bazel, Buck); Amazon e Netflix em microrepo, alinhado à filosofia de microsserviços.
- **Amazon Prime Video** migrou o serviço de monitoramento de serverless para monolítico e reduziu 90% do custo — contraponto útil ao entusiasmo com decomposição.

---
Ref: [[ByteByteGo System Design Archive]], [[CIDR]], [[Latency Numbers]], [[Container]], [[System Design MOC]]
