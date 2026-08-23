# GLPI 11 - Descoberta

> [!info]
> Vault de descoberta do **GLPI 11**, um sistema livre de gestão de serviços de TI (ITSM). Substrato **neutro**, sem opinião de método: descreve o sistema como ele realmente existe, com cada afirmação rastreável a uma nota de evidência em `09 Evidence`.

Duas fontes autorizadas, duas lentes complementares:

- **`SRC-001` · Código-fonte do GLPI 11.0.7.** Engenharia reversa: *como foi implementado*.
- **`SRC-002` · Documentação oficial do usuário GLPI 11.0** (227 arquivos Sphinx). Visão funcional: *como se usa e configura*.

## Por onde começar

- [[MOC - Arquitetura (global)]]: mapa da visão de **código** (SRC-001).
- [[MOC - Documentação do Usuário (global)]]: mapa da visão de **uso e configuração** (SRC-002).
- [[Registro de Evidências]]: todas as evidências, por fonte e módulo.

## Taxonomia

Cada pasta responde uma pergunta sobre o sistema: o que ele é, por que existe, do que é composto, como funciona, que dados manipula, quais evidências o sustentam. A descrição de cada pasta, na árvore do vault, declara essa pergunta, e é ela que decide onde uma nota entra.

## O contrato de evidência

A regra central deste vault: **nenhuma afirmação sem evidência.**

1. Toda nota de conhecimento (pastas 01 a 08) cita em `source` as notas de evidência que a sustentam: `[[EV-1-008]]`, `[[EV-2-b2-001]]`.
2. Toda nota de evidência (pasta 09) cita a fonte primária exata: arquivo e linhas do código, ou arquivo da documentação, e termina com a seção `## Sustenta`, listando as notas de conhecimento que dependem dela.
3. O que a fonte não responde não vira suposição: vira uma nota de **investigação** (pasta 11), com identificador próprio, aguardando resposta.
4. Quando uma fonte responde a investigação aberta por outra, o cruzamento é registrado e a investigação original é **preservada**: a baixa de status é decisão humana, não automática.

Identificadores estáveis: evidências `EV-{sessão}-{seq}` (código) e `EV-2-{subagente}-{seq}` (documentação); investigações `INV-…` no mesmo padrão. O identificador entra no título da nota e em `aliases`, para que `[[EV-1-001]]` resolva.

## Frontmatter obrigatório

```yaml
---
title: EV-1-001 · CommonDBTM é o active-record base com ciclo add/update/delete
aliases: [EV-1-001]
tags: [evidence, dominio/foundation]
type: evidence       # overview | process | component | behavior | data | integration | operational | evidence | decision | investigation | view | moc
status: confirmed    # draft | confirmed | superseded
source: "SRC-001 · src/CommonDBTM.php · linhas 68, 336, 1286–1405"
author: CAD Discovery
created: 2026-07-10
---
```

- `tags` carregam o domínio funcional com prefixo: `dominio/foundation`, `dominio/service-desk`, `dominio/ativos`.
- `source` de nota de conhecimento aponta evidências; `source` de evidência aponta a fonte primária.
- `status: superseded` marca nota substituída por leitura mais recente, sem apagá-la.

## Regras de escrita

1. **Neutralidade.** O vault descreve, não recomenda. Julgamentos de valor não entram; conclusões e premissas de trabalho vão para `10 Decisions`, declaradas como tais.
2. **Citação literal em evidência.** A evidência transcreve o trecho relevante em `> [!quote]` com a referência exata; paráfrase é para as notas de conhecimento.
3. **Uma nota, um artefato ou um comportamento.** `Ticket`, `Change` e `Problem` são três notas, ainda que compartilhem a mesma base.
4. **Todo componente entra no MOC do seu domínio** no momento em que a nota é criada.
5. **Lacuna da própria documentação oficial também é investigação**: registrar a omissão é parte da descoberta.
