---
title: Obsidian URI
aliases:
  - obsidian://
  - Protocolo Obsidian
  - x-callback-url
tags:
  - obsidian
  - automation
  - uri
  - plugin
type: concept
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
> [!abstract]
> **Obsidian URI** é o protocolo de URI customizado `obsidian://` que dispara ações no app — abrir uma nota, criar outra, buscar — permitindo automação e fluxos entre aplicativos.

## Conceito

O URI é a interface *declarativa* do Obsidian: você não descreve um procedimento, você endereça uma intenção. Qualquer coisa capaz de abrir um link — um atalho do sistema, um app de terceiros, uma nota de outro programa — pode acionar o Obsidian sem saber nada sobre ele.

O preço dessa universalidade é o alcance: existem **sete actions**, e o retorno é limitado ao `x-callback-url`. Para tudo o mais, existe o [[Obsidian CLI]].

## Sintaxe

```
obsidian://action?param1=value&param2=value
```

Dois shorthands equivalentes:

```
obsidian://vault/my vault/my note
obsidian:///absolute/path/to/my note
```

O primeiro equivale a `obsidian://open?vault=my%20vault&file=my%20note`; o segundo, a `obsidian://open?path=%2Fabsolute%2Fpath%2Fto%2Fmy%20note`.

> [!warning] Encoding
> "Ensure that your values are properly URI encoded. For example, forward slash characters `/` must be encoded as `%2F` and space characters must be encoded as `%20`." Um caractere reservado mal codificado quebra a interpretação inteira do URI.

Com encoding correto, dá para navegar até um heading ou um [[Block Reference|bloco]]: `Note%23Heading` leva ao heading "Heading"; `Note%23%5EBlock` leva ao bloco "Block".

## As sete actions

| Action | O que faz | Parâmetros documentados |
|---|---|---|
| `open` | Abre um vault ou um arquivo dentro dele | `vault`, `file`, `path`, `prepend`, `append`, `paneType` |
| `new` | Cria uma nota, opcionalmente com conteúdo | `vault`, `name`, `file`, `path`, `paneType`, `content`, `clipboard`, `silent`, `append`, `overwrite`, `x-success` |
| `daily` | Cria ou abre a [[Daily Note\|daily note]]; exige o plugin Daily notes | Os mesmos da action `new` |
| `unique` | Cria uma [[Unique Note (Zettelkasten Prefix)\|unique note]]; exige o plugin Unique note creator | `vault`, `paneType`, `content`, `clipboard`, `x-success` |
| `search` | Abre a busca, opcionalmente já executando um termo | `vault`, `query` |
| `choose-vault` | Abre o vault manager | — |
| `hook-get-address` | Integração com o app Hook | `vault`, `x-success`, `x-error` |

Notas sobre os parâmetros:

- `vault` aceita o **nome** do vault ou o **Vault ID**
- `file` aceita nome de arquivo ou caminho a partir da raiz do vault; a extensão `md` pode ser omitida
- `path` é um caminho absoluto do sistema de arquivos e **sobrescreve tanto `vault` quanto `file`** — o app procura o vault mais específico que contenha o caminho e o resto vira o `file`
- `name` define o nome do arquivo a criar; a localização segue a preferência *Default location for new notes*. `file` sobrescreve `name`
- `overwrite` só age se `append` não estiver definido
- `paneType`: ausente substitui a última tab ativa; `tab` abre em nova tab; `split` em novo tab group; `window` em pop-out window — **apenas desktop**

## Vault ID e x-callback-url

O **Vault ID** é o código aleatório de **16 caracteres** atribuído ao vault, por exemplo `ef6ca3e3b524d22f`, único por pasta no computador. Copia-se abrindo o vault switcher e escolhendo **Copy vault ID** no menu de contexto do vault desejado.

Quando `x-success` está presente, o Obsidian devolve ao callback:

- `name` — o nome do arquivo, sem a extensão
- `url` — o URI `obsidian://` do arquivo
- `file` — a URL `file://` do arquivo, **apenas desktop**

## Registro do protocolo

No Windows e no macOS, rodar o app uma vez basta. No Linux o processo é bem mais envolvido: criar um arquivo `obsidian.desktop`, garantir que o campo `Exec` esteja como `Exec=executable %u` — o `%u` é o que repassa os URIs ao app — e, no caso do instalador AppImage, desempacotá-lo com `Obsidian-x.y.z.AppImage --appimage-extract` e apontar o `Exec` para o executável extraído.

## Comparação

| | Obsidian URI | [[Obsidian CLI]] |
|---|---|---|
| Natureza | Declarativa — endereça uma intenção | Imperativa — executa um comando |
| Alcance | **7 actions** fixas | "Anything you can do in Obsidian" |
| Quem pode chamar | Qualquer coisa que abra um link | Terminal e scripts |
| Retorno | Só via `x-callback-url` | Saída em stdout, com `--copy` para o clipboard |
| Pré-requisito | Protocolo registrado no SO | Instalador 1.12 e app rodando |

## Veja também

- [[Obsidian CLI]]
- [[Daily Note]]
- [[Unique Note (Zettelkasten Prefix)]]
- [[Automatizar o Obsidian por URI e CLI]]
