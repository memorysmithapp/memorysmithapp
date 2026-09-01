Este arquivo é a **fonte única de verdade** de todo o comportamento do agente neste projeto.
O Claude Code o lê automaticamente a cada sessão e a cada invocação de sub-agente.

---

## Identidade do projeto

### Organização
memorysmithapp

### Nome do projeto
memorysmithapp

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
0.3.0

### Estado atual
Versão 0.3.0, que endureceu e poliu o que a 0.2.0 entregou, sem abrir bounded context novo. Ela trouxe a interface responsiva com dois pontos de quebra, o grafo montado por interruptores de atributo, com grupo que se segura ao clique e que responde ao toque, a quota do plano aplicada de fato em vez de apenas declarada, a superfície de leitura das notas seguindo as métricas do tema padrão do Obsidian, e a correção de defeitos de consistência entre a projeção do Discovery e o conteúdo das notas. Antes dela, a 0.2.0 entregou os seis bounded contexts, a infraestrutura inteira em CDK, a interface ligada à API real e o conector MCP com leitura e escrita, autenticado pelo proxy CIMD na frente do Cognito; e a 0.1.0 entregou a documentação canônica, o protótipo navegável do frontend sobre o seed e o spike de autenticação do MCP. O ambiente sobe e desce pelos scripts de `deploy-aws/`, e o deploy na AWS acontece com acompanhamento passo a passo do usuário.

### Remote do git
github.com/memorysmithapp/memorysmithapp

---

## Layout do repositório

Um monorepo pnpm com **três projetos de primeiro nível**, nomeados a partir do identificador do projeto. Estrutura completa e justificativa em `docs/architecture-guide.md` §5.

```
memorysmithapp/
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

## Documentação canônica

Quatro documentos em `docs/`, todos em pt-BR, cada um a fonte única de verdade de uma pergunta. **Cada documento se delimita no próprio preâmbulo**, que diz o que ele contém e o que não contém, e este arquivo não repete esse inventário. Aqui fica só a regra de onde escrever.

| O parágrafo responde | Ele pertence a |
|---|---|
| "Isto é verdade sobre Markdown / MCP / auditoria em geral" | [`docs/knowledge-base.md`](docs/knowledge-base.md) |
| "Isto é o que o nosso produto faz, e sob qual regra" | [`docs/software-vision.md`](docs/software-vision.md) |
| "Isto é **como o software é construído**" | [`docs/architecture-guide.md`](docs/architecture-guide.md) |
| "Isto é **como o trabalho flui**, da necessidade ao merge" | [`docs/development-process.md`](docs/development-process.md) |
| "Isto é o que ainda vamos **decidir, avaliar ou construir**" | **Issue no GitHub, nunca em `docs/`** |

Quando um fato parece caber em dois documentos, ele entra em exatamente um e o outro **o referencia por seção**, jamais o repete. Duplicação entre esses arquivos é o modo de falha que esta estrutura existe para evitar.

As duas últimas linhas da tabela separam o que mais confunde. O teste: "o outbox garante entrega ao menos uma vez" muda o código, então é arquitetura; "toda mudança chega à `main` por pull request" não muda uma linha, muda o caminho até ela, então é processo. E a linha final é absoluta: **hipótese de necessidade, roadmap, risco em aberto e questão não decidida nunca entram em `docs/`**, porque descrevem futuro.

> **O documento nunca descreve futuro. Se está no documento, está em produção.**

### Códigos de regra de negócio

Regras de negócio são declaradas apenas no `software-vision.md`, uma regra por linha, com um código estável:

```
RN-{CONTEXT}-{NNN}
```

`CONTEXT` é a sigla de três letras do bounded context: `SUB` (assinatura e isolamento), `ACC` (acesso: membros, papéis, convites), `KNW` (conhecimento), `DSC` (discovery), `AUD` (auditoria), `AGT` (acesso de agente / MCP), `PRT` (portabilidade).

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

O mesmo vale para os termos da **linguagem ubíqua** do produto, que existem simultaneamente como conceito no texto e como símbolo no código: `Vault`, `Subscription`, `Guidance`, `Template`, `Note`, `Content Slot`, `Content Role`, `Vault Context`. Traduzi-los na prosa romperia a correspondência entre o texto e o código, que é justamente o que a linguagem ubíqua existe para garantir. Termos técnicos consagrados de engenharia seguem a mesma regra e permanecem na forma original: bounded context, outbox, single-table design, embeddings, chunking, backlink, value object.

Um termo em inglês que **não** é símbolo do código nem termo técnico consagrado deve ser escrito em português.

### A exceção do `README.md` e da interface em `pt_BR`

O `README.md` da raiz é vitrine, não especificação: quem o lê ainda não conhece o vocabulário do produto, e um termo em inglês ali cobra do leitor um aprendizado antes de ele entender o que o produto faz. O mesmo vale para quem usa o produto em português: os textos do locale `pt_BR` da interface falam com o usuário final, não com quem lê a especificação. Por isso, **e somente nesses dois lugares**, dois papéis são escritos em português:

| Na linguagem ubíqua e nos `docs/` | No `README.md` e no locale `pt_BR` |
|---|---|
| `Guidance` | Orientação |
| `Template` | Modelo |

A exceção é deliberada e não se propaga. Em `docs/`, no código, nas ferramentas MCP, no `Content Role` e no locale `en_US` (o canônico), os termos continuam sendo `guidance` e `template`. Nenhum outro termo da linguagem ubíqua é traduzido: `Vault`, `Subscription` e os demais permanecem como estão. `Note` é o caso trivial: "nota" é palavra comum do português e é assim que o locale `pt_BR` a escreve.

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
| 13 | **O teto de papel por vault só rebaixa um papel, nunca eleva.** O papel efetivo é `min(papel de assinatura, teto do vault)`, com o owner da assinatura acima dos dois. | `Role` é um enum ordenado que expõe `Role.min`, e nenhum caminho de código atribui papel diretamente |

---

## Políticas operacionais

O processo completo, com o ciclo que leva uma necessidade da issue até a `main`, está em [`docs/development-process.md`](docs/development-process.md). O que segue é a forma normativa: o que nunca pode ser violado. O porquê e o detalhe operacional vivem no documento de processo, e **onde este arquivo resume, ele nunca repete o texto de lá**.

### Arquivos ignorados

Sempre que criar, mover, apagar ou modificar arquivos e diretórios, avalie se `.gitignore` e `.dockerignore` precisam ser atualizados. Os dois são revisados juntos, porque uma mudança que afeta um normalmente afeta o outro.

**Atualize o `.gitignore`** ao surgirem saídas de build (`dist/`, `cdk.out/`, `build/`), dependências (`node_modules/`), ambiente ou segredo (`.env`, `*.key`), cache ou temporários (`.cache/`, `tmp/`, `.turbo/`), arquivos de IDE (`.idea/`, `.vscode/`, `.obsidian/`) ou cobertura (`coverage/`). **Nunca deixe arquivo sensível não rastreado sem entrada.**

**Atualize o `.dockerignore`** ao surgir qualquer coisa que não deva entrar no contexto de build. Ele sempre inclui: `.git/`, `.claude/`, `.obsidian/`, `node_modules/`, `dist/`, `cdk.out/`, `coverage/`, `tests/`, `*.log`, `.env`, `.env.*`, `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `docs/`. Se não existir e houver arquivos Docker, crie-o.

### Versionamento

A versão canônica do produto vive **neste arquivo**, em § Identidade do projeto → Versão base, e é propagada para todo `package.json` do monorepo e para o `CHANGELOG.md` antes do commit de release. Os três projetos compartilham uma versão única, porque são implantados juntos.

| Tipo de mudança | Incremento |
|---|---|
| Quebra de contrato de ferramenta MCP ou da API, migração destrutiva de chave ou schema | Maior (`2.0.0`) |
| Nova ferramenta MCP, nova funcionalidade visível, novo serviço, nova rota | Menor (`0.2.0`) |
| Correção de defeito, ajuste de configuração, refatoração sem impacto externo | Correção (`0.1.1`) |

**Enquanto a versão base for `0.x`, a regra acima não vale:** o SemVer trata essa faixa como instável, e uma quebra de contrato entra como incremento menor, registrada no `CHANGELOG.md` sob `Removed` ou `Changed`. A partir da `1.0.0` ela passa a valer sem exceção, porque aí existe alguém integrado do outro lado.

**Invioláveis:** o incremento de versão chega à `main` somente por PR, nunca por push direto. A tag é criada **depois** do merge e aponta para o commit mesclado. O fluxo de nove passos está em `development-process.md` §9.1.

### CHANGELOG

Atualize o `CHANGELOG.md` **no mesmo commit** da mudança que ele documenta, e nunca acumule entradas para o fim da branch.

Use as categorias do [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`. Escreva da perspectiva do usuário e do agente, nunca da implementação, e agrupe entradas pequenas sob a mesma categoria em vez de uma por arquivo tocado. Restruturações de documentação em `docs/` recebem entrada.

**Bom:** `Adicionado o argumento asOf em read_note, que devolve a revisão vigente em uma data`
**Ruim:** `Atualizado NoteQueryHandler.ts para aceitar um timestamp opcional`

### Proteção de branch

A `main` é protegida. **Toda mudança chega a ela apenas por pull request revisado e mesclado no GitHub**, valendo igualmente para features, correções, documentação, manutenção e incremento de versão.

- Nunca commite nem faça push direto na `main`.
- Nunca contorne a proteção. Não use "Bypass rules and merge", `gh ... --admin`, `git push --no-verify` nem equivalente, mesmo tendo direito de administrador.
- Se um merge estiver bloqueado, **pare e reporte**. Pergunte como proceder em vez de sobrepor a regra.
- As únicas escritas diretas na `main` são tags anotadas sobre commits já mesclados.

### Nomes de branch

| Prefixo | Uso | Exemplo |
|---|---|---|
| `release/` | O ciclo que fecha uma versão inteira | `release/v0.4.0` |
| `feat/` | Funcionalidade pontual | `feat/note-move` |
| `fix/` | Correção pontual | `fix/graph-touch-target` |
| `docs/` | Documentação e governança do repositório | `docs/development-process` |
| `chore/` | Manutenção: dependências, CI, configuração de build | `chore/bump-cdk` |

Nomes de branch são en-US. A convenção anterior, `feature-2026.NNNNNN`, está registrada como histórico em `development-process.md` §7.1 e não é mais usada.

### Commits incrementais

Commite e envie ao longo da branch, nunca acumulando tudo no fim. Todo commit precisa ser construível e não pode quebrar os testes existentes.

**A unidade de commit é a mudança de comportamento inteira: código, teste, documento e `CHANGELOG.md` no mesmo commit.** O critério de quando um commit toca cada documento está em `development-process.md` §7.3.

Mensagens em modo imperativo e tempo presente, seguindo Conventional Commits, por exemplo `feat(knowledge): adiciona value object Position fracionário`. Envie a cada commit, ou no mínimo a cada dois ou três.

### Pull request

Toda descrição de PR contém duas seções: um **Resumo das mudanças** e uma **Análise de produtividade com IA**. O formato de ambas, e como preencher cada campo da segunda, estão em `development-process.md` §8.

Uma mudança que implementa ou altera uma regra de negócio cita o código `RN-XXX` dela. Uma mudança originada de feedback referencia a issue com `Closes #N`.
