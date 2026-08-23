---
title: Comandos Linux Essenciais
aliases:
  - Linux Commands
  - Comandos Linux
tags:
  - linux
  - operating-system
  - infrastructure
type: practice
status: evergreen
source: 18 Most-used Linux Commands e Most Used Linux Commands Map — BIG ARCHIVE System Design 2023
author: ByteByteGo (Alex Xu, Sahn Lam)
created: 2026-07-25
---
> [!abstract]
> O conjunto de comandos que cobre a maior parte da operação diária em Linux, organizado por **categoria de tarefa** em vez de ordem alfabética — porque o problema real nunca é lembrar o nome, é saber qual categoria resolve.

## Quando usar

Ao investigar um incidente, depurar um [[Container]] ou navegar por uma máquina desconhecida. É também a porta de entrada prática para o [[Filesystem Hierarchy Standard (FHS)]]: explorar com `cd` e `ls` é como o layout deixa de ser teoria.

## Dinâmica

As categorias e o que cada uma responde:

| Categoria | Pergunta que responde | Comandos |
|---|---|---|
| **Arquivos e diretórios** | O que existe e onde? | `ls`, `cd`, `pwd`, `mkdir`, `cp`, `mv`, `rm`, `find` |
| **Visualização e edição** | O que tem dentro? | `cat`, `less`, `head`, `tail`, `grep`, `vi`, `nano` |
| **Processos** | O que está rodando? | `ps`, `top`, `kill`, `killall`, `nice` |
| **Informação do sistema** | Como está a máquina? | `uptime`, `free`, `df`, `du`, `uname` |
| **Usuários e grupos** | Quem pode o quê? | `whoami`, `id`, `chmod`, `chown`, `sudo` |
| **Rede** | Consigo alcançar? | `ping`, `traceroute`, `netstat`, `ss`, `curl`, `dig`, `host` |
| **Conexão remota** | Como chego lá? | `ssh`, `scp` |
| **Agendamento** | Quando roda de novo? | `sleep`, `watch`, `crontab` |
| **Pacotes** | Como instalo? | `apt`, `yum`, `dnf`, `rpm` |

## Regras

1. **Diagnóstico segue a pilha, de cima para baixo.** Aplicação (`ps`, `top`) → recurso (`free`, `df`) → rede (`ping`, `ss`, `dig`) → log (`tail -f`, `journalctl`). Pular etapas é o que faz investigações darem voltas.
2. **`tail -f` sobre `/var/log` é o primeiro reflexo em incidente** — e o lembrete de por que log local em contêiner efêmero não serve. Ver [[Logging]].
3. **Combinar é o ponto, não decorar.** O poder está no *pipe*: `ps aux | grep java | wc -l` responde algo que nenhum comando sozinho responde.
4. **`rm -rf` não pergunta e não desfaz.** Conferir o `pwd` antes é hábito, não paranoia.
5. **Em contêiner, metade dos comandos não existe.** Imagens mínimas não trazem `ps`, `curl` ou `dig` — por desenho, o mesmo desenho que evita imagens infladas. Depurar exige um contêiner efêmero de diagnóstico.

## Exemplo

Investigando latência alta em um serviço:

```bash
top                        # a CPU está saturada?
free -h                    # sobrou memória?
df -h                      # o disco encheu? (causa clássica e silenciosa)
ss -tunap | grep :8080     # quantas conexões abertas na porta do serviço?
tail -f /var/log/app.log   # o que o serviço está dizendo agora?
dig servico-dependente     # a resolução de nome está respondendo?
```

O disco cheio merece destaque: é a falha que se manifesta como comportamento estranho da aplicação, não como erro de disco — e foi exatamente o gatilho do incidente descrito em [[Distributed Systems]], em que um servidor com disco cheio derrubou um site inteiro.

---
Ref: [[Filesystem Hierarchy Standard (FHS)]], [[Processo de Boot do Linux]], [[Processo (Computação)]], [[Container]], [[Logging]], [[Distributed Systems]]
