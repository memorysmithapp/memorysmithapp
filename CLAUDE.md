Este arquivo é a **fonte única de verdade** de todo o comportamento do agente neste projeto.
O Claude Code o lê automaticamente a cada sessão e a cada invocação de sub-agente.

---

## Identidade do projeto

### Organização
memorysmith

### Nome do projeto
core

### Identificador do projeto
memorysmith

### Domínio do produto
memorysmith.app

### O que faz
O MemorySmith.app hospeda vaults de conhecimento em Markdown que se autodescrevem, com estrutura, ordenação e Guidance de autoria declarados como dado, e os serve nativamente às ferramentas de IA por meio de um MCP server remoto. O agente não apenas lê um vault: ele escreve nele, obedecendo ao Guidance do próprio vault e aos Templates de cada pasta.

### Slogan
Structured knowledge, natively readable and writable by agents.

### Identidade visual
Definida no caderno de marca "Livro da marca v1" (Figma). O símbolo é um grafo que forma um cérebro: cada círculo é uma nota, cada haste é uma ligação. Nunca redesenhar o símbolo nem criar combinações de cor fora das quatro versões do caderno.
- **Cor primária:** Azul cofre `#0F56D7` (estrutura). Acentos: Laranja sinal `#FF8A2B` (captura) e Verde nó `#16A34A` (conexão; nunca conduz uma peça sozinho). Neutros: Tinta `#0E1526` (texto), Papel `#EDEFEC` (fundo claro) e Fundo escuro `#0B1220` (modo escuro). Proporção de uso: fundo 70%, azul 18%, laranja 8%, verde 4%
- **Tipografia:** Space Grotesk (Bold no logotipo e títulos, Medium em rótulos e interface) e Inter (texto corrido). Tracking de −2,5% no logotipo; o sufixo `.app` do wordmark é sempre Laranja sinal
- **Tom visual:** sóbrio e legível. A superfície do produto é uma ferramenta de leitura antes de ser uma ferramenta de edição

### Versão base
0.1.0

### Estado atual
Versão 0.1.0 na `main`, com a 0.2.0 em construção na branch de trabalho. A 0.1.0 entregou a documentação canônica, o protótipo navegável do frontend sobre o seed e o spike de autenticação do MCP, validado em ambiente real na AWS e depois desmontado. A 0.2.0 constrói as entregas 2 a 12 do `docs/architecture-guide.md` §25: os seis bounded contexts, a infraestrutura inteira em CDK e a interface ligada à API real. O deploy na AWS acontece com acompanhamento passo a passo do usuário.

### Remote do git
github.com/memorysmithapp/memorysmithapp

---

## Layout do repositório

Um monorepo pnpm com **três projetos de primeiro nível**, nomeados a partir do identificador do projeto. Estrutura completa e justificativa em `docs/architecture-guide.md` §5.

```
core/
├── memorysmith-backend/     # six bounded contexts + shared kernel + event contracts
│   ├── packages/            # kernel and contracts
│   ├── services/            # access, knowledge, discovery, audit, agent, portability
│   └── apps/core-monolith/  # the composition root of the main deployable
├── memorysmith-frontend/    # React SPA
└── memorysmith-infra/       # all CDK: stacks, constructs, IAM policies, pipeline
```

**Nunca coloque código de infraestrutura dentro do projeto de backend, e nunca coloque a definição de uma stack dentro de um serviço.** O projeto de infra declara recursos para os três projetos, inclusive o bucket que serve o frontend e o pipeline que faz o deploy de tudo, e por isso não pode viver dentro de nenhum deles. Isso também mantém as credenciais de deploy separáveis do código de aplicação.

**Direção de dependência entre os projetos, única e verificada em CI:**

```
memorysmith-infra      →  references backend and frontend artifacts (bundling, deploy)
memorysmith-backend    →  knows nothing about infra or frontend
memorysmith-frontend   →  imports @memorysmith/contracts (types only) and calls the API at runtime
```

Um `import` de `memorysmith-infra` dentro de `memorysmith-backend` é um erro de arquitetura, não uma questão de estilo. Serviços também nunca se importam entre si: comunicação entre contextos é HTTP com autenticação IAM ou um evento, nunca um `import`.

Ao criar um arquivo, decida onde ele fica perguntando o que ele é, não para que ele serve: um construct de CDK para a tabela de auditoria pertence a `memorysmith-infra/constructs/`, ainda que só o serviço de auditoria o use.

---

## Referência de arquitetura

A arquitetura de engenharia completa vive em um único documento canônico:

| Arquivo | Idioma | Papel |
|---|---|---|
| [`docs/architecture-guide.md`](docs/architecture-guide.md) | Português (pt-BR) | **Versão canônica**, fonte única de verdade de todas as decisões de engenharia |

Contém: stack de tecnologia, estrutura do monorepo, DDD tático (agregados, value objects, eventos de domínio), portas e adaptadores hexagonais, isolamento por assinatura, desenho single-table no DynamoDB, Content Slots, transações e outbox, projeções de discovery, armazenamento de proveniência, integração MCP/OAuth, API interna, infraestrutura, requisitos não funcionais, estratégia de testes, CI/CD, antipadrões e a sequência de construção.

**Não** contém: visão de produto, regras de negócio (códigos `RN-XXX`), telas de usuário ou fatos gerais do domínio. Esses vivem nos dois documentos abaixo.

---

## Base de conhecimento

A documentação do projeto se divide em duas outras preocupações, conhecimento de domínio e visão de software:

### Base de conhecimento de domínio (gestão de conhecimento em Markdown e o ecossistema de agentes)

| Arquivo | Idioma | Papel |
|---|---|---|
| [`docs/knowledge-base.md`](docs/knowledge-base.md) | Português (pt-BR) | **Versão canônica**, fatos de domínio sobre o espaço em que o produto opera |

Contém **apenas fatos de domínio** que continuariam verdadeiros se este produto não existisse: Markdown e sua sintaxe universal, a prática de gestão de conhecimento pessoal (vaults, wikilinks, backlinks, templates), o Model Context Protocol e seu modelo de autorização, como clientes de agente consomem conectores, engenharia de contexto, recuperação (embeddings, chunking, RAG) e seus modos de falha, grafos de conhecimento, exigências de auditoria e proveniência em trabalho regulado, obrigações da LGPD e conceitos gerais de isolamento em SaaS multi-tenant. Nenhuma entidade do MemorySmith, nenhum código `RN-XXX`, nenhuma arquitetura.

### Visão de software (requisitos de produto e regras de negócio)

| Arquivo | Idioma | Papel |
|---|---|---|
| [`docs/software-vision.md`](docs/software-vision.md) | Português (pt-BR) | **Versão canônica**, autoritativa para todas as decisões de implementação |

Contém: visão e tese do produto, princípios de produto, linguagem ubíqua, o **modelo de negócio** (Subscription → Workspace → Vault, ciclo de vida da assinatura, papéis), matriz de permissões e teto de papel por vault, mapa de bounded contexts do ponto de vista de produto, entidades de domínio com definição de campos, regras de negócio (códigos `RN-XXX`), o catálogo de ferramentas MCP como **contrato de produto**, telas, export, recorte de versão e riscos de produto.

Para detalhes técnicos de implementação (desenho de chaves do DynamoDB, Content Slots, mecânica do outbox, triggers do Cognito, stacks de CDK), sempre remeta a `docs/architecture-guide.md`. O `software-vision.md` não pode duplicar esse conteúdo.

### Regra de fronteira entre os três documentos

Antes de escrever um parágrafo em `docs/`, decida a qual pergunta ele responde:

| O parágrafo responde | Ele pertence a |
|---|---|
| "Isto é verdade sobre Markdown / MCP / auditoria em geral" | `knowledge-base.md` |
| "Isto é o que o nosso produto faz, e sob qual regra" | `software-vision.md` |
| "Isto é como construímos" | `architecture-guide.md` |

Quando um fato parece caber em dois documentos, ele entra em exatamente um e o outro **o referencia por seção**, jamais o repete. Duplicação entre esses três arquivos é o modo de falha que esta estrutura existe para evitar.

### Códigos de regra de negócio

Regras de negócio são declaradas apenas no `software-vision.md`, uma regra por linha, com um código estável:

```
RN-{CONTEXT}-{NNN}
```

`CONTEXT` é a sigla de três letras do bounded context: `SUB` (assinatura e isolamento), `ACC` (acesso: workspaces, membros, papéis, convites), `KNW` (conhecimento), `DSC` (discovery), `AUD` (auditoria), `AGT` (acesso de agente / MCP), `PRT` (portabilidade).

Os códigos são **append-only**. Nunca renumere uma regra e nunca reutilize um código aposentado, porque outros documentos, commits e issues os referenciam. Uma regra que deixou de valer é marcada como removida na própria linha, preservando seu número.

---

## Higiene da documentação

**Nunca acrescente notas de versão, datas de revisão ou rodapés de uso interno a qualquer arquivo em `docs/`.** Linhas da forma:

```
*Documento para uso interno de desenvolvimento. Última revisão: … — vX.Y (…)*
```

são proibidas. Elas duplicam informação já registrada no histórico do git e no `CHANGELOG.md`, saem de sincronia imediatamente e acrescentam ruído que o leitor precisa filtrar.

**Onde o histórico de mudanças pertence:**

- **`CHANGELOG.md`**, o único lugar onde mudanças notáveis do projeto são registradas, incluindo atualizações relevantes de documentação. Acrescente a entrada ao abrir um pull request, e não como nota de rodapé dentro do documento editado.
- **Mensagens de commit do git**, já que todo commit registra o que mudou, quando e por quê. Essa é a trilha de auditoria das edições de documento.

**Regra:** ao editar qualquer arquivo `docs/*.md`, não adicione, não atualize e não preserve nenhuma nota de rodapé que mencione número de versão, data de revisão ou a expressão "uso interno de desenvolvimento". Se uma nota assim já existir em um arquivo que está sendo editado, remova-a na mesma mudança.

---

## Política de idioma

**Toda a documentação do repositório é escrita em português do Brasil (pt-BR). Todo o código fonte da solução é escrito em inglês americano (en-US).**

### Escrito em pt-BR

- `docs/*.md`, os três documentos de arquitetura, produto e domínio
- `README.md`
- `CHANGELOG.md`, com exceção dos títulos de categoria do formato Keep a Changelog (`Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`), que são vocabulário do padrão e permanecem em inglês
- `CLAUDE.md`
- Mensagens de commit e descrições de pull request, preservando em inglês apenas os prefixos e escopos de Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `chore(release)`), que são tokens de ferramenta
- Qualquer outro documento de prosa criado no repositório

### Escrito em en-US

- Código fonte: identificadores, comentários e docblocks
- Nomes de branch
- Arquivos de configuração
- Mensagens de log e de erro no código
- Nomes de atributo do DynamoDB, componentes de chave do S3, nomes de evento do EventBridge
- Nomes de endpoint da API, nomes e descrições de ferramentas MCP
- Textos de interface visíveis ao usuário, que devem usar chaves de tradução i18n e nunca literais no código. `en_US` é o locale canônico e `pt_BR` é o segundo locale obrigatório. Os dois arquivos de tradução precisam permanecer sincronizados

### Termos que nunca são traduzidos

Dentro de um texto em pt-BR, **identificadores de código, caminhos de arquivo, nomes de campo de entidade, nomes de evento, nomes de ferramenta e códigos de erro permanecem em en-US e nunca são traduzidos**. Um documento em pt-BR que cita `NoteId`, `get_vault_context` ou `PRECONDITION_FAILED` os escreve exatamente como o código escreve.

O mesmo vale para os termos da **linguagem ubíqua** do produto, que existem simultaneamente como conceito no texto e como símbolo no código: `Vault`, `Workspace`, `Subscription`, `Guidance`, `Template`, `Note`, `Content Slot`, `Content Role`, `Vault Context`. Traduzi-los na prosa romperia a correspondência entre o texto e o código, que é justamente o que a linguagem ubíqua existe para garantir. Termos técnicos consagrados de engenharia seguem a mesma regra e permanecem na forma original: bounded context, outbox, single-table design, embeddings, chunking, backlink, value object.

Um termo em inglês que **não** é símbolo do código nem termo técnico consagrado deve ser escrito em português.

### A exceção do `README.md` e da interface em `pt_BR`

O `README.md` da raiz é vitrine, não especificação: quem o lê ainda não conhece o vocabulário do produto, e um termo em inglês ali cobra do leitor um aprendizado antes de ele entender o que o produto faz. O mesmo vale para quem usa o produto em português: os textos do locale `pt_BR` da interface falam com o usuário final, não com quem lê a especificação. Por isso, **e somente nesses dois lugares**, dois papéis são escritos em português:

| Na linguagem ubíqua e nos `docs/` | No `README.md` e no locale `pt_BR` |
|---|---|
| `Guidance` | Orientação |
| `Template` | Modelo |

A exceção é deliberada e não se propaga. Em `docs/`, no código, nas ferramentas MCP, no `Content Role` e no locale `en_US` (o canônico), os termos continuam sendo `guidance` e `template`. Nenhum outro termo da linguagem ubíqua é traduzido: `Vault`, `Workspace` e os demais permanecem como estão. `Note` é o caso trivial: "nota" é palavra comum do português e é assim que o locale `pt_BR` a escreve.

### Travessão

**O travessão (`—`) é proibido na prosa da documentação.** Em português ele produz frases longas e ambíguas, e quase sempre existe uma pontuação melhor: vírgula para aposto, dois pontos para explicação, ponto final para uma oração que se sustenta sozinha, parênteses para incidente.

A proibição vale para a prosa. Continua permitido usar o caractere onde ele não é pontuação: como marcador de célula vazia em tabela, dentro de blocos de código, em desenhos de árvore e em diagramas ASCII.

### Formatação sensível a locale

Formatação de data e número é comportamento de runtime, conduzido pelas APIs `Intl` e governado pelo locale ativo, não por esta política.

---

## Regras de desenho inegociáveis

Estas são as decisões estruturais do sistema. Elas estão declaradas por extenso em `docs/architecture-guide.md` e são repetidas aqui porque violar qualquer uma delas não é um defeito para corrigir depois: é uma reescrita. Quando uma tarefa parecer exigir quebrar uma delas, pare e levante a questão em vez de contornar.

| # | Regra | Onde é garantida |
|---|---|---|
| 1 | **Toda chave começa pela assinatura.** Toda chave de item do DynamoDB começa por `S#{subscriptionId}` e toda chave de S3 por `s/{subscriptionId}/`. Existem exatamente duas exceções, ambas nomeadas no desenho: o elo usuário↔assinatura e o índice da fila de plataforma. | Os construtores de chave aceitam apenas um value object `SubscriptionId` |
| 2 | **O `subscriptionId` vem da claim do JWT, nunca da requisição.** Não vem de path, query, body nem header. | Lambda Authorizer e `SubscriptionContext` injetado por requisição |
| 3 | **`domain/` e `application/` não importam o AWS SDK.** Sem exceção, incluindo "só para pegar um tipo". | Regra do `dependency-cruiser` em CI, que quebra o build |
| 4 | **A chave do S3 é opaca.** Ela não codifica vault, pasta, nome nem papel, apenas um `ContentId`. Renomear, mover e reordenar jamais podem escrever um byte no S3. | `s/{subscriptionId}/c/{contentId}.md` é construída apenas dentro do adaptador de S3 |
| 5 | **O backend nunca interpreta o conteúdo da nota.** Frontmatter, nomes de campo e convenções pertencem ao Guidance e ao Template do vault. O backend lê apenas sintaxe universal de Markdown (links, headings). | `LinkExtractor` e `FacetExtractor`, ambos em projeções do Discovery, são os únicos leitores de conteúdo; o core não lê conteúdo |
| 6 | **A trilha de auditoria é append-only por IAM, não por disciplina.** O papel de auditoria carrega um `Deny` explícito em `UpdateItem` e `DeleteItem`. | Política de IAM e um teste de isolamento na suíte |
| 7 | **Toda operação de domínio que muda estado recebe um `Authorship`.** Não existe mutação anônima; a assinatura do método a torna impossível. | Assinaturas dos métodos de agregado |
| 8 | **Apagar uma nota nunca destrói bytes.** Apenas soft delete; destruir bytes é ato administrativo com porta própria, papel próprio e evento próprio. | `ContentStore` não tem método `purge` |
| 9 | **Um recurso proibido devolve `404`, nunca `403`.** O `403` confirmaria a existência de algo que o solicitante não pode ver. | Taxonomia de erros em `memorysmith-backend/packages/kernel` |
| 10 | **A transação de uma nota nunca escreve no item `META` do vault.** Esse item único viraria o ponto de contenção do vault inteiro sob ingestão em lote. | Formato da transação no repositório e um teste de concorrência |
| 11 | **O identificador da assinatura é perpétuo.** Nenhuma transição de status, seja aprovar, suspender, cancelar ou reativar, move, rechaveia ou apaga dado. O status governa acesso, nunca endereço. | `SubscriptionId` é `readonly` e nenhum repositório lê status para construir chave |
| 12 | **Uma sessão de administrador de plataforma não carrega assinatura.** Seu token não tem a claim `subscription_id`, então nenhum repositório de Knowledge pode sequer ser construído sob ela. Nunca acrescente uma checagem de papel como substituto: a impossibilidade é a garantia. | `SubscriptionContext` exige a claim, e um teste de isolamento verifica o modo de falha |
| 13 | **O teto de papel por vault só rebaixa um papel, nunca eleva.** O papel efetivo é `min(papel de workspace, teto do vault)`, com o owner da assinatura acima dos dois. | `Role` é um enum ordenado que expõe `Role.min`, e nenhum caminho de código atribui papel diretamente |

---

## Política de arquivos ignorados

Sempre que o Claude cria, move, apaga ou modifica arquivos e diretórios, ele precisa avaliar se `.gitignore` e `.dockerignore` precisam ser atualizados.

**Atualize o `.gitignore` quando:** surgirem novos diretórios de saída de build (`dist/`, `cdk.out/`, `build/`), diretórios de dependências (`node_modules/`), arquivos de ambiente ou segredo (`.env`, `*.key`), diretórios de cache ou temporários (`.cache/`, `tmp/`, `.turbo/`), arquivos de IDE e editor (`.idea/`, `.vscode/`, `.obsidian/`) ou diretórios de cobertura (`coverage/`).

**Atualize o `.dockerignore` quando:** existirem novos diretórios que não devem ser copiados para o contexto de build, forem adicionados novos artefatos de build ou configurações locais, ou forem criados novos arquivos de segredo ou ambiente.

**Regras:**
- Nunca deixe arquivos sensíveis não rastreados sem entrada no `.gitignore`
- Mantenha o contexto de build enxuto e nunca copie arquivo desnecessário
- Os dois arquivos precisam ser revisados juntos, porque uma mudança que afeta um normalmente afeta o outro
- Se o `.dockerignore` não existir e houver arquivos Docker presentes, crie-o
- Se o `.gitignore` não existir, crie-o antes de commitar qualquer arquivo novo

**Entradas padrão que o `.dockerignore` sempre deve incluir:**
```
.git/
.claude/
.obsidian/
node_modules/
dist/
cdk.out/
coverage/
tests/
*.log
.env
.env.*
README.md
CHANGELOG.md
CLAUDE.md
docs/
```

---

## Política de versionamento

Este projeto usa um **modelo de versionamento em três camadas**, definido por extenso em `docs/architecture-guide.md` § Estratégia de versionamento. O resumo abaixo governa o comportamento do agente.

### Fonte de verdade

A versão canônica do produto vive no `CLAUDE.md`, em `## Identidade do projeto → Versão base`.
Ela precisa ser propagada para todo `package.json` do monorepo e para o `CHANGELOG.md` antes que o commit de release seja feito.

### Quando incrementar

| Tipo de mudança | Incremento |
|---|---|
| Quebra de contrato de ferramenta MCP, quebra de contrato da API, migração destrutiva de chave ou schema | Maior (`2.0.0`) |
| Nova ferramenta MCP, nova funcionalidade visível ao usuário, novo serviço, nova rota de API | Menor (`0.2.0`) |
| Correção de defeito, ajuste de configuração, refatoração sem impacto externo | Correção (`0.1.1`) |

A superfície de ferramentas MCP é o **contrato público** do produto (`docs/software-vision.md` § MCP). Remover uma ferramenta, renomear um argumento ou estreitar um formato de retorno é incremento maior, mesmo que nenhuma API interna tenha mudado.

### Fluxo de incremento de versão

Execute nesta ordem exata:

```
1. Update  CLAUDE.md                                       ← bump "Versão base" under Identidade do projeto
2. Update  memorysmith-backend/package.json
           memorysmith-backend/packages/*/package.json
           memorysmith-backend/services/*/package.json     ← every service package
3. Update  memorysmith-frontend/package.json
4. Update  memorysmith-infra/package.json
5. Update  CHANGELOG.md                                    ← cut the release section with date and summary
6. Commit on a release branch  "chore(release): bump version to vX.Y.Z"
7. Push the branch, open a PR, and merge it into main (never push the bump directly to main)
8. Tag the merged commit on main  git tag vX.Y.Z && git push origin vX.Y.Z
9. Publish a GitHub Release for the tag, with notes copied from that version's CHANGELOG section
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <changelog-section>
```

Os três projetos compartilham uma única versão de produto, porque são implantados juntos e uma divergência entre eles nunca significa nada para o usuário.

Os passos 1 a 5 precisam entrar no mesmo commit da branch de release. O incremento de versão chega à `main` somente pelo PR do passo 7, e nunca por push direto. Nunca marque a tag antes do PR estar mesclado e nunca envie uma tag cujo commit ainda não esteja na `main`. A tag precisa apontar para o commit mesclado, e o GitHub Release do passo 9 é criado a partir dessa tag.

---

## Política de manutenção do CHANGELOG

O `CHANGELOG.md` precisa ser mantido atualizado ao longo de toda a vida de uma branch de feature, e não apenas no momento do release.

### Quando atualizar

Atualize o `CHANGELOG.md` **no mesmo commit** da mudança que ele documenta. Todo commit incremental que altere comportamento visível ao usuário, acrescente uma capacidade, corrija um defeito ou remova algo precisa incluir a entrada correspondente na seção `[Unreleased]`.

**Não** acumule entradas de changelog para o fim da branch. Cada entrada pertence ao commit que a introduziu.

### Como escrever as entradas

Use as categorias do [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Escolha a mais precisa:

| Categoria | Use quando |
|---|---|
| `Added` | Nova funcionalidade, nova ferramenta MCP, nova rota, novo serviço, nova opção de configuração |
| `Changed` | Mudança de comportamento em funcionalidade existente, migração de chave ou schema, redesenho de UI |
| `Fixed` | Correção de defeito. Descreva o sintoma que foi corrigido |
| `Removed` | Funcionalidade, rota, ferramenta, campo ou dependência removida |
| `Deprecated` | Algo marcado para remoção futura |
| `Security` | Correção de vulnerabilidade ou endurecimento de segurança (isolamento por assinatura, autorização, imutabilidade da auditoria) |

Escreva as entradas da perspectiva do usuário e do agente, não da implementação. Descreva o que mudou no produto, não quais arquivos foram editados.

**Bom:** `Adicionado o argumento asOf em read_note, que devolve a revisão vigente em uma data`
**Ruim:** `Atualizado NoteQueryHandler.ts para aceitar um timestamp opcional`

Agrupe várias entradas pequenas sob a mesma categoria em vez de escrever uma entrada por arquivo tocado.

Restruturações de documentação dentro de `docs/` são mudanças notáveis e recebem entrada.

### No momento do release

Ao cortar um release, seguindo o fluxo de incremento de versão, renomeie `[Unreleased]` para `[{versão}] - {data}`, acrescente a nova seção `[Unreleased]` vazia acima dela e atualize os links de comparação no fim do arquivo.

---

## Política de proteção de branch

A `main` é uma branch protegida. **Toda mudança chega à `main` apenas por um pull request revisado e mesclado no GitHub**, valendo igualmente para features, correções, documentação, tarefas de manutenção e incrementos de versão.

**Regras rígidas:**
- Nunca commite nem faça push direto na `main`. Sempre crie uma branch de trabalho (`feat/…`, `fix/…`, `chore/…`, `docs/…`), envie-a, abra um PR e mescle pelo GitHub.
- Nunca contorne a proteção de branch. Não use "Bypass rules and merge", `gh ... --admin`, `git push --no-verify` nem qualquer equivalente, mesmo tendo direito de administrador para isso.
- Se um merge estiver bloqueado, por exemplo por falta de uma revisão obrigatória, pare e reporte. Pergunte ao usuário como proceder em vez de sobrepor a regra.
- As únicas escritas que tocam a `main` diretamente são **tags anotadas** sobre commits já mesclados (ver Política de versionamento → Fluxo de incremento de versão).

**Por quê:** a regra de proteção é a camada real de garantia, e contorná-la em silêncio anula o propósito. Rotear toda mudança por um PR mantém a `main` revisável, auditável e sempre verde.

---

## Política de commits incrementais

Ao trabalhar em uma branch de feature, commite e envie incrementalmente. Não acumule todas as mudanças em um único commit no fim da tarefa.

**Quando commitar:**
- Depois de concluir qualquer unidade de trabalho autocontida (um agregado, uma porta com seu adaptador em memória, uma rota de API, uma stack de CDK, uma suíte de testes passando).
- Sempre que alcançar um marco relevante, mesmo que a tarefa como um todo ainda não esteja pronta.
- Antes de trocar de contexto para outra área do código dentro da mesma tarefa.

**Higiene de commit:**
- Todo commit precisa ser construível e não pode quebrar os testes existentes. Nunca commite um estado pela metade que deixe a branch quebrada.
- Escreva uma mensagem de commit concisa e descritiva, seguindo o estilo do projeto: modo imperativo, tempo presente, por exemplo `feat(knowledge): adiciona value object Position fracionário`.
- Envie para a branch remota depois de cada commit, ou no mínimo a cada dois ou três commits consecutivos.

**Por quê:** pushes frequentes protegem o trabalho em andamento contra falha da máquina local, facilitam a revisão por oferecerem um histórico claro das decisões e permitem que colaboradores acompanhem o progresso sem esperar o PR final.

---

## Política de pull request

Toda descrição de pull request precisa conter duas seções: um **Resumo das mudanças** e uma **Análise de produtividade com IA**.

### Resumo das mudanças

Descreva o que mudou, por quê, e quais decisões de arquitetura estão envolvidas. Siga o modelo de PR existente no repositório, se houver um. Quando uma mudança implementa ou altera uma regra de negócio, cite o código `RN-XXX` dela.

### Análise de produtividade com IA

Acrescente esta seção ao corpo de todo PR. Colete os dados do histórico do git e do diff, sem adivinhar e sem omitir campos.

```
## Análise de produtividade com IA

| Métrica | Valor |
|---|---|
| Linhas de código manipuladas (adicionadas + removidas) | {loc_added + loc_removed} ({loc_added} adicionadas, {loc_removed} removidas) |
| Duração da branch | {duration} (de `{branch_start_date}` a `{pr_date}`) |
| Tecnologias envolvidas | {lista separada por vírgula} |

### Esforço humano estimado (sem assistência de IA)

> **Esforço estimado:** {hours}h, equivalente a aproximadamente {total_days} dias de trabalho (8h/dia) ou {total_weeks} semanas de trabalho (40h/semana).
```

**Como preencher cada campo:**

- **Linhas de código manipuladas:** rode `git diff --stat origin/main...HEAD` e some as inserções e remoções da linha final de totais. Exclua da contagem os arquivos de lock (`pnpm-lock.yaml`, `package-lock.json`).
- **Duração da branch:** use a data do primeiro commit da branch como início, e a data de hoje como data do PR.
- **Tecnologias envolvidas:** liste toda linguagem, framework, biblioteca e ferramenta tocada pelo diff, por exemplo TypeScript, Node.js, AWS CDK, DynamoDB, S3, Bedrock, React, Vite, Hono, Zod. Derive das extensões dos arquivos alterados e dos imports, e não liste tecnologias que existem no repositório mas não foram tocadas por este PR.
- **Esforço humano estimado:** produza uma estimativa realista única de quanto tempo uma pessoa engenheira levaria para entregar o mesmo resultado sozinha, sem assistência de IA. Baseie a estimativa em:
  - **Volume:** total de linhas manipuladas (adicionadas + removidas), ponderado por complexidade, distinguindo código repetitivo de código com lógica densa.
  - **Amplitude:** número de tecnologias distintas envolvidas, já que cada tecnologia adicional acrescenta curva de aprendizado e custo de integração.
  - **Indicadores de escopo:** número de agregados, portas, adaptadores, rotas de API, ferramentas MCP e stacks de CDK novos, além da cobertura de testes acrescentada.
  - Expresse o resultado em horas, por exemplo `8h` ou `2h`. Se o escopo for muito pequeno (menos de 1h), use `< 1h`.
- **Esforço total estimado:** use o valor único de horas acima. Em seguida calcule:
  - `{total_days}` = `{hours}` ÷ 8, arredondado para uma casa decimal
  - `{total_weeks}` = `{hours}` ÷ 40, arredondado para uma casa decimal
  - Se a estimativa for `< 1h`, trate como `0.5h` para efeito de conta e registre a aproximação na própria linha.
