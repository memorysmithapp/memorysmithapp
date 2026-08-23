---
title: Automatizar o Obsidian por URI e CLI
aliases:
  - Automação do Obsidian
  - URI, CLI e Headless
  - Obsidian Automation
tags:
  - obsidian
  - automation
  - sync
  - pkm
  - practice
type: practice
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
Existem três degraus de automação do Obsidian, e escolher o errado custa caro: a Obsidian URI não exige instalação nenhuma e funciona de qualquer app que saiba abrir um link, mas cobre poucas ações; a Obsidian CLI cobre tudo que o app faz e devolve saída estruturada, mas exige o app rodando; e o Obsidian Headless roda sem app algum, só que apenas para Sync e Publish. A prática é saber em qual degrau cada tarefa cabe — e reconhecer que o mais poderoso também é o mais perigoso.

## Dinâmica / Passo a Passo

1. **Comece pela URI quando o gatilho vem de fora.** Formato `obsidian://action?param1=value&param2=value`, com as ações `open`, `new`, `daily`, `unique`, `search` e `choose-vault` (mais a integração `hook-get-address`). Não há nada a instalar: no Windows e no macOS, rodar o app uma vez já registra o protocolo. No Linux o processo é bem mais longo — criar um `obsidian.desktop` com `Exec=executable %u`.
2. **Monte a URI com encoding correto e o vault certo.** `obsidian://open?vault=my%20vault&file=my%20note`; `%2F` para barra e `%20` para espaço. O `vault=` aceita o nome ou o **vault ID**, um código aleatório de 16 caracteres, único por pasta, copiável pelo menu de contexto do vault switcher em **Copy vault ID**. Com encoding, dá para navegar até heading (`Note%23Heading`) ou bloco (`Note%23%5EBlock`). Há ainda dois atalhos: `obsidian://vault/my vault/my note` e `obsidian:///absolute/path/to/my note`.
3. **Registre e verifique a CLI.** Exige o instalador 1.12.7 ou superior; em **Settings → General**, ative **Command line interface** e siga o prompt de registro. No macOS, isso cria um symlink em `/usr/local/bin/obsidian` (com pedido de privilégio administrativo); no Linux, copia o binário para `~/.local/bin/obsidian`, que precisa estar no PATH. Reinicie o terminal depois de registrar.
4. **Use a CLI para o trabalho do dia a dia**, em comando único ou na TUI (`obsidian` sozinho abre a interface, com autocomplete, histórico e `Ctrl+R` para busca reversa):

```shell
obsidian daily                                  # abre a daily note
obsidian daily:append content="- [ ] Comprar café"
obsidian search query="meeting notes"
obsidian create name="Trip to Paris" template=Travel
obsidian tags counts
obsidian diff file=README from=1 to=3
```

5. **Estruture a saída para pipelines** com `format=json` (disponível em comandos como `tasks`, `properties`, `backlinks`, `unresolved`, `base:query`) e use `--copy` em qualquer comando para mandar o resultado ao clipboard:

```shell
obsidian tasks todo format=json
obsidian base:query file=Leituras view="A revisar" format=csv
obsidian search query="TODO" --copy
```

6. **Suba para o Headless quando não deve haver app.** Requer Node.js 22 ou superior e assinatura ativa do Sync:

```shell
npm install -g obsidian-headless
ob login
ob sync-list-remote
cd ~/vaults/my-vault && ob sync-setup --vault "My Vault"
ob sync --continuous
```

`ob sync-config` ajusta modo (`bidirectional`, `pull-only`, `mirror-remote`), estratégia de conflito, tipos de arquivo, categorias de configuração e pastas excluídas — tudo por flag, sem interface.

## Regras

- **Codifique tudo.** *"An improperly encoded 'reserved' character may break the interpretation of the URI."* Não é o parâmetro que quebra: é a URI inteira.
- **`vault=` vem sempre antes do comando** na CLI: `obsidian vault=Notes daily`, não `obsidian daily vault=Notes`. Sem ele, vale o vault da pasta atual do terminal ou o vault ativo.
- **`path=` para script determinístico, `file=` para conveniência.** `file=<name>` resolve pelo mesmo mecanismo dos wikilinks, casando pelo nome sem caminho nem extensão — ótimo à mão, ambíguo em automação. `path=` exige o caminho exato desde a raiz do vault. Na URI, `path=` é um caminho absoluto do sistema e sobrepõe `vault` e `file`.
- **`eval` e `dev:cdp` executam código arbitrário dentro do processo do Obsidian.** `obsidian eval code="app.vault.getFiles().length"` roda JavaScript no console do app; `dev:cdp` dispara métodos do Chrome DevTools Protocol. É a superfície mais poderosa da CLI e, pela mesma razão, a mais perigosa — qualquer coisa capaz de montar uma string de comando passa a ser capaz de rodar código no seu app.
- **Nunca rode o Sync do app e o Headless Sync no mesmo dispositivo.** *"Do not use both the desktop app Sync and Headless Sync on the same device, as it can cause data conflicts."*
- **A CLI exige o app rodando.** Se ele não estiver, o primeiro comando o inicia — o que num servidor ou num cron é exatamente o que você não quer.
- **O Headless cobre menos, e isso é a proposta.** Apenas Sync e Publish, sem editor, sem plugins, sem UI.

## Exemplo

Um agente precisa ler e escrever num vault sincronizado, num servidor, sem sessão gráfica. A leitura ingênua da situação é "dar acesso ao computador para o agente"; a leitura correta é que o Headless **reduz** a superfície em vez de aumentá-la — a própria doc lista entre os usos: *"Give agentic tools access to a vault without access to your full computer."*

```shell
ob sync-setup --vault "Knowledge-Vault" --device-name "agente-ci" --config-dir .obsidian
ob sync-config --mode pull-only --excluded-folders "00 Inbox,zz Scratch"
ob sync
```

O que o agente alcança é uma cópia do vault, sem `00 Inbox`, sem poder empurrar mudanças de volta enquanto o modo for `pull-only`, e sem qualquer caminho para o resto da máquina. Comparado a rodar `obsidian eval` contra um app desktop aberto na sessão de alguém, é o mesmo trabalho com uma fração do raio de alcance. Ver [[Threat Modeling]].

| Degrau | Instalação | Precisa do app | Alcance | Uso típico |
|---|---|---|---|---|
| Obsidian URI | nenhuma | sim | 6 actions + `hook-get-address` | Atalhos, links de outros apps |
| Obsidian CLI | registro no app | sim | tudo que o app faz | Scripts locais, `format=json` |
| Obsidian Headless | `npm i -g obsidian-headless` | não | Sync e Publish | CI, cron, agentes |

---
Ref: [[Obsidian URI]], [[Obsidian CLI]], [[Obsidian Sync]], [[Obsidian Publish]], [[URI, URL e URN]], [[Threat Modeling]], [[Configurar Sync com Sincronização Seletiva]], [[Daily Note]]
