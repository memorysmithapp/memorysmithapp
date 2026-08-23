---
title: Obsidian Help 07
aliases:
  - Obsidian Help — Serviços Gerenciados
tags:
  - obsidian
  - pkm
  - literature
  - sync
  - publish
  - encryption
type: literature
status: evergreen
source: Obsidian Help — obsidian.md/help
author: Obsidian
created: 2026-08-07
---
# 07 — Serviços Gerenciados: Sync, Publish, Web Clipper e Teams

*Obsidian Sync · Obsidian Publish · Obsidian Web Clipper · Teams — todas as páginas*

## Resumo executivo

Os quatro serviços hospedados são construídos **sobre** a premissa local-first, não contra ela: cada um define um limite explícito de saída de dados. O eixo é feito de limites numéricos, fronteiras onde a fidelidade quebra, e a franqueza ao declarar o que o Sync *não* criptografa.

## Principais ideias

### Cada serviço define um limite explícito de saída de dados

O disco local continua sendo a fonte. No Sync, *"Obsidian doesn't encrypt your local vault"*, e o [[Remote Vault|remote vault]] é armazenamento centralizado ao qual os local vaults se conectam — diferente de Dropbox ou iCloud, onde a nuvem é passthrough entre pastas monitoradas. No Publish só as notas escolhidas saem.

### A criptografia do Sync é declarada com o que ela não cobre

O padrão é **end-to-end encryption**: AES-256 em modo GCM, chave derivada por **scrypt with salt**. A alternativa, *standard encryption*, usa chave gerenciada pelo Obsidian — comparada a Google Docs e iCloud sem Advanced Data Protection, menos segura porque a chave no servidor descriptografa. O incomum é a seção **Limitations**: fica fora do E2EE qual dispositivo subiu ou apagou um arquivo, quando, e o **mapeamento** entre paths e conteúdo criptografados, legível pelo servidor para rotear mudanças e montar version history, com risco declarado de adulteração. Mesma franqueza no hash determinístico de deduplicação: economiza banda, mas permite a quem force uploads confirmar se um arquivo já existia. Ver [[Criptografia Simétrica e Assimétrica]].

### Os limites moldam o uso, não só o preço

Standard: 1 vault, arquivo de até **5 MB**, 1 GB, [[Version History|history]] de **1 mês**. Plus: 10 vaults, **200 MB**, 10 a 100 GB, **12 meses**. Anexos seguem regra própria: versões antigas duram **duas semanas**, o que a doc converte em receita de downgrade — apagar anexos, esperar a purga, e só então rebaixar preservando os `.md`. Trocar de região é destrutivo: os dados remotos são substituídos e **todo o version history se perde**. E **as Sync settings não sincronizam**.

### Publish é o espelho do Web Clipper

O mesmo frontmatter que estrutura a entrada controla a saída: `publish: true` inclui, `publish: false` ignora, e `publish: true` **sobrepõe** pastas excluídas — *"because `publish: true` gives more specific control"*. `permalink` reescreve a URL; um [[Alias (Obsidian)|alias]] com o **caminho completo** da nota antiga cria o redirect. As fronteiras de fidelidade são explícitas: plugins que renderizam em runtime não sobrevivem — Dataview falha, o Waypoint funciona porque emite Markdown puro; a busca é só texto plano; e mídia pesada vai para [[Content Delivery Network (CDN)|CDN]], com teto de **50 MB** por arquivo e **4 GB** por site.

### O Web Clipper é a boca do funil, com precedência e ordem de avaliação

A captura tem precedência declarada: template customizado vence, senão a seleção, senão os highlights. São **cinco tipos de variável** — preset (`{{content}}`), prompt (`{{"a summary"}}`), meta, selector e schema.org — com filters encadeáveis. A restrição decisiva é a ordem: template logic (`{% if %}`, `{% for %}`, `{% set %}`) roda **primeiro**, e as prompt variables só depois vão ao Interpreter — dá para montar prompts dinamicamente, não para ramificar sobre a resposta. O contexto padrão é o HTML inteiro, reduzível com `{{selectorHtml:#main}}`, e as requisições vão **direto ao provider**.

### Dois modelos de colaboração deliberadamente assimétricos

No Sync **todo colaborador paga**: assinatura obrigatória, teto de 20 usuários, permissões planas — todos recebem as do dono, menos convidar. No Publish o custo se inverte: só o dono assina, e a matriz separa publicar (ambos) de configurar site e permissões (só o dono). Mas **o Publish não sincroniza os vaults locais** — sincronizar entre colaboradores é manual, via *Use live version*, que sobrescreve a nota local. Por isso emparelhar Publish com [[Obsidian Sync]] ou Git é requisito operacional.

## Conceitos apresentados

- [[Obsidian Sync]] — o serviço e seus limites de plano
- [[Remote Vault]] — centralizado, não passthrough
- [[End-to-End Encryption]] — AES-256-GCM, scrypt, e o que fica fora
- [[Version History]] — retenção por plano e a regra dos anexos
- [[Obsidian Publish]] — publicação seletiva e fidelidade
- [[Obsidian Web Clipper]] — template, variáveis e Interpreter
- [[Configurar Sync com Sincronização Seletiva]] — selective sync
- [[Publicar um Vault com Obsidian Publish]] — publicação
- [[Captura Web com Template de Clipper]] — captura

## Exemplos

> [!quote] Sync, Security and privacy — o que não é end-to-end criptografado
> *"Some metadata is not end-to-end encrypted: which device uploaded or deleted a file, when it was uploaded, and the mapping between encrypted file paths and encrypted content."*

> [!quote] Web Clipper, Logic — a ordem de avaliação
> *"You can use template logic to construct prompts dynamically, but prompt results are not available for use in conditionals or loops."*

---
Ref: [[Obsidian Help]], [[Obsidian Sync]], [[End-to-End Encryption]], [[Obsidian Publish]], [[Obsidian Web Clipper]]
