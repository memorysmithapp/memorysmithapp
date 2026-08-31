# Processo de desenvolvimento

Como o trabalho flui neste projeto, da necessidade de quem usa até o merge na `main`.

Este documento responde a uma pergunta que nenhum dos outros três responde. O
`knowledge-base.md` diz o que é verdade no domínio, o `software-vision.md` diz o que o
produto faz e sob qual regra, o `architecture-guide.md` diz como o software é construído,
e aqui está **como se trabalha**. A distinção entre os dois últimos é a que mais confunde,
e o teste é simples: "o outbox garante entrega ao menos uma vez" muda o código, então é
arquitetura; "toda mudança chega à `main` por pull request" não muda uma linha de código,
muda o caminho até ele, então é processo.

## Índice

1. [Os artefatos e o papel de cada um](#1-os-artefatos-e-o-papel-de-cada-um)
2. [O ciclo de vida de uma mudança](#2-o-ciclo-de-vida-de-uma-mudança)
3. [Captura: de onde vem a necessidade](#3-captura-de-onde-vem-a-necessidade)
4. [Triagem: destilar necessidade de pedido](#4-triagem-destilar-necessidade-de-pedido)
5. [Priorização e roadmap](#5-priorização-e-roadmap)
6. [Reserva de código de regra de negócio](#6-reserva-de-código-de-regra-de-negócio)
7. [Trabalho na branch](#7-trabalho-na-branch)
8. [Pull request](#8-pull-request)
9. [Release](#9-release)
10. [O que nunca entra em docs/](#10-o-que-nunca-entra-em-docs)

---

## 1. Os artefatos e o papel de cada um

| Artefato | Responde | Para quem | Muda quando |
|---|---|---|---|
| `README.md` | "O que é isso e como eu uso" | Quem chega, incluindo quem só usa | O produto ou o procedimento de instalação muda |
| `docs/software-vision.md` | "O que o produto faz, e sob qual regra" | Quem constrói | Uma `RN-XXX`, entidade ou limite muda |
| `docs/architecture-guide.md` | "Como o software é construído" | Quem constrói | Uma decisão técnica muda |
| `docs/knowledge-base.md` | "O que é verdade no domínio" | Quem constrói | Quase nunca, porque independe do produto |
| `docs/development-process.md` | "Como o trabalho flui" | Quem constrói | Este processo muda |
| `CLAUDE.md` | "O que o agente nunca pode violar" | O agente | Uma regra inegociável entra ou sai |
| `CHANGELOG.md` | "O que mudou, quando" | Todos | Todo commit que muda comportamento |
| **Issues e Project** | "O que ainda vamos decidir, avaliar ou construir" | Todos | O tempo todo |

A última linha é a que governa tudo o mais neste documento. Hipótese de necessidade,
priorização, roadmap, risco em aberto e questão não decidida vivem **em issue**, nunca em
`docs/`. Foi assim que este processo nasceu: as seções de recorte de versão, riscos e
questões em aberto foram removidas dos documentos e viraram issues, porque elas
envelheciam a cada semana enquanto o resto dos documentos envelhecia a cada versão.

### 1.1 A regra que mantém os documentos honestos

> **O documento nunca descreve futuro. Se está no documento, está em produção.**

Um documento que descreve o que ainda não foi construído é a dívida que este processo
existe para eliminar, e ela se paga duas vezes: uma quando o plano muda e o texto não
acompanha, outra quando alguém constrói contra um texto que nunca foi verdade.

A regra é verificável, e não é boa intenção. Toda `RN-XXX` declarada no
`software-vision.md` tem código que a implementa, hoje em 96 arquivos e mais de 300
citações. Quando a regra for quebrada, ela será quebrada de forma detectável.

O `README.md` obedece à mesma regra com força dobrada. Um documento interno que descreve o
inexistente atrapalha quem constrói; um `README` que descreve o inexistente quebra a
confiança de quem tentou seguir, e essa pessoa é justamente a que aceitou testar primeiro.
Nada de "em breve" ou "planejado" ali dentro. Direção pública se comunica pelo Project e
pelos Releases, e o `README` no máximo aponta o link.

---

## 2. O ciclo de vida de uma mudança

| # | Etapa | Onde vive | O que é verdade nessa etapa |
|---|---|---|---|
| 1 | **Captura** | Issue `feedback` | É hipótese de necessidade. Ninguém prometeu nada |
| 2 | **Triagem** | Comentários na issue | O atrito real é destilado do pedido. Sai proposta ou recusa registrada |
| 3 | **Escopo fechado** | Issue `proposta` + Project | Ganha versão alvo e reserva os códigos `RN-XXX` que vai criar |
| 4 | **Implementação** | Branch, commits incrementais | Código, teste, documento e changelog avançam juntos |
| 5 | **Estado consistente** | `main`, pelo PR mesclado | O que está no documento existe e está em produção |

Nenhuma etapa pode ser pulada por pressa, com uma exceção nomeada: um **defeito que impede
o uso** entra direto na etapa 4, e a issue que o descreve é escrita junto com a correção,
não antes. Adiar a correção para cumprir o rito seria trocar o propósito do processo pela
sua forma.

---

## 3. Captura: de onde vem a necessidade

Uma necessidade chega por três caminhos, e todos terminam em issue:

- **Quem usa o produto**, pelo formulário de feedback de uso.
- **Quem constrói**, ao topar com um atrito ou um risco enquanto trabalha.
- **A operação**, quando um alarme, uma fatura ou uma medição revela algo.

### 3.1 O formulário de feedback e a ordem das perguntas

O formulário em `.github/ISSUE_TEMPLATE/01-feedback.yml` pergunta, nesta ordem: o que a
pessoa **estava tentando fazer**, o que **aconteceu**, o que ela **esperava**, como ela
**contornou**, com que frequência isso ocorre, e só então, por último e explicitamente
opcional, o que ela faria para resolver.

A ordem é deliberada e é a decisão de desenho mais importante do formulário. Pedidos
chegam escritos como solução ("queria um botão de duplicar nota") e não como atrito
("copio a estrutura de nota à mão toda vez que crio uma reunião"). Se o formulário
perguntasse a solução primeiro, receberia a solução e perderia o atrito, que é a única
parte que continua verdadeira depois que escolhemos um caminho diferente do sugerido.

A pergunta sobre o contorno costuma render mais que todas as outras: **quem contornou
mediu a dor**, e o tamanho do contorno é o tamanho dela.

### 3.2 O que nunca vai para issue pública

O repositório é público. Duas coisas ficam de fora:

- **Conteúdo real de vault**, nome de cliente ou dado de negócio. O formulário pede
  confirmação explícita disso, e uma issue que escapou é editada assim que percebida.
- **Falha de isolamento ou qualquer vulnerabilidade**, que seguem por `SECURITY.md` e pelo
  canal privado de advisory. Uma issue pública descrevendo como alcançar dado de outra
  assinatura é instrução de exploração enquanto a correção não sai.

---

## 4. Triagem: destilar necessidade de pedido

A triagem acontece em lote, semanalmente, e não a cada mensagem que chega. Reagir a cada
pedido individualmente é como se constrói o produto de uma pessoa só, e com poucos
usuários cada voz tem peso desproporcional.

O comando `/triagem-feedback` lê as issues abertas com a label `feedback`, agrupa por
atrito real em vez de por pedido, e devolve uma proposta de classificação para cada grupo.

### 4.1 A primeira pergunta

> **Isto se resolve escrevendo, ou só se resolve construindo?**

Boa parte do que chega como falta de funcionalidade é falta de `README`. "Não consegui
conectar o vault ao meu agente" pode ser uma lacuna do produto ou um parágrafo faltando.
Confundir os dois é o erro mais caro do processo, porque constrói funcionalidade para
resolver um problema de texto.

### 4.2 As quatro saídas

| Saída | Label | Custo | Gera `RN-XXX`? |
|---|---|---|---|
| **Documentação** | `tipo:documentacao` | Um PR de minutos | Não |
| **Defeito** | `tipo:defeito` | Correção | Não, restaura o que a regra já afirma |
| **Lacuna** | `tipo:lacuna` ou `tipo:atrito` | Entra no roadmap como `proposta` | Em geral sim |
| **Recusa** | a issue fecha | Um comentário | Não |

**A recusa é uma saída de primeira classe e precisa ser escrita.** Uma issue recusada fecha
com o motivo em um comentário, dirigido a quem reportou. Backlog sem recusa registrada não
é backlog, é um depósito, e o custo aparece quando alguém reabre em seis meses a mesma
discussão que já foi tida.

### 4.3 Classificação

Toda issue triada recebe uma label de contexto (`ctx:SUB`, `ctx:ACC`, `ctx:KNW`,
`ctx:DSC`, `ctx:AUD`, `ctx:AGT`, `ctx:PRT`, `ctx:UI`, `ctx:Infra`), que é a mesma sigla de
três letras dos códigos de regra de negócio. Isso faz a triagem já apontar para o bounded
context, e revela cedo quando um pedido cruza dois deles, que é o sinal de que ele são
dois pedidos.

---

## 5. Priorização e roadmap

O roadmap vive no **Project do GitHub**, e não em documento. Os campos são poucos de
propósito, porque campo que ninguém preenche é campo que mente:

| Campo | Valores |
|---|---|
| `Status` | Triagem, Aceito, Em construção, Entregue, Recusado, Adiado |
| `Contexto` | as siglas dos bounded contexts, mais UI e Infra |
| `Tipo` | Defeito, Atrito, Lacuna, Documentação |
| `Versão alvo` | `0.4.0`, `0.5.0`, Sem data |

Risco e questão em aberto também vivem em issue, com as labels `risco`, `risco-tecnico` e
`questao`. A diferença deles para uma `proposta` é que **não fecham por entrega**: fecham
quando o risco não se materializa mais, quando a questão é decidida, ou quando viram uma
proposta concreta. Cada um carrega, no corpo, o critério explícito do que o fecha.

---

## 6. Reserva de código de regra de negócio

Os códigos `RN-{CONTEXT}-{NNN}` são append-only: nunca são renumerados nem reutilizados,
porque commits, PRs e mais de 300 linhas de código os referenciam.

Isso cria uma exigência de coordenação, e ela é resolvida assim:

> **O número da regra é reservado na issue de `proposta`, no passo 3. O texto normativo
> entra no `software-vision.md` no passo 4, junto com o código que o cumpre.**

A separação protege as duas coisas ao mesmo tempo. O número fica queimado no instante em
que o escopo fecha, então duas frentes paralelas não colidem no mesmo `RN-KNW-025` mesmo
que uma delas demore semanas. E o documento não passa a afirmar uma regra que ainda não
existe, o que preservaria o append-only às custas da regra de §1.1.

Se a branch for abandonada, **o número continua queimado** e a issue é o registro de que
ele foi consumido. Um código aposentado sem nunca ter existido custa menos que um código
reutilizado.

---

## 7. Trabalho na branch

A `main` é protegida. Toda mudança chega a ela por pull request revisado, sem exceção,
incluindo documentação, manutenção e incremento de versão. A única escrita direta são tags
anotadas sobre commits já mesclados.

### 7.1 Convenção de nomes

O projeto tem dois tipos de branch, e o nome diz qual é:

| Prefixo | Uso | Exemplo |
|---|---|---|
| `release/` | O ciclo que fecha uma versão inteira | `release/v0.4.0` |
| `feat/` | Funcionalidade pontual | `feat/note-move` |
| `fix/` | Correção pontual | `fix/graph-touch-target` |
| `docs/` | Documentação e governança do repositório | `docs/development-process` |
| `chore/` | Manutenção: dependências, CI, configuração de build | `chore/bump-cdk` |

`release/` não usa prefixo de Conventional Commits de propósito: a branch de um ciclo
contém muitos tipos ao mesmo tempo, e rotulá-la `feat/` seria impreciso no primeiro `fix`
que entrar nela. Os commits **dentro** dela continuam usando os tipos normais, e é ali que
o Conventional Commits pertence.

Nomes de branch são escritos em en-US, como todo o restante que não é prosa.

> **Convenção anterior, preservada como histórico:** as branches `feature-2026.000001`,
> `feature-2026.000002` e `feature-2026.000003` correspondem, na ordem, às versões
> `0.1.0`, `0.2.0` e `0.3.0`. O sequencial exigia uma tabela de tradução para dizer o que a
> branch fazia, e é isso que `release/vX.Y.Z` corrige. As branches antigas não são
> renomeadas, porque estão referenciadas nos pull requests já mesclados.

### 7.2 Commits incrementais

Commite e envie ao longo da branch, nunca acumulando tudo no fim. Todo commit precisa ser
construível e não pode quebrar os testes existentes.

A unidade de commit é a **mudança de comportamento inteira**: código, teste, documento e
`CHANGELOG.md` no mesmo commit. Não é trabalho a mais, é o que impede a documentação de
ser escrita de memória dias depois da decisão, quando o motivo dela já evaporou. Também é
a tarefa que se corta quando a branch atrasa, e cortá-la é justamente o que não se pode.

### 7.3 Quando o commit toca cada documento

| Toca `docs/` ou `README.md` | Não toca |
|---|---|
| Cria ou altera uma `RN-XXX` | Refatoração sem mudança de comportamento |
| Muda a matriz de permissões ou o teto de papel por vault | Ajuste de teste, lint ou formatação |
| Muda o contrato de uma ferramenta MCP: nome, argumento ou formato de retorno | Mudança de infraestrutura sem efeito visível |
| Muda um limite declarado, uma entidade ou a linguagem ubíqua | Correção que **restaura** o comportamento que o documento já descreve |
| Muda uma decisão de arquitetura registrada | Trabalho intermediário que ainda não mudou nada afirmável |
| Muda o procedimento de instalação, os pré-requisitos ou os scripts de `deploy-aws/` | |
| Entra ou sai uma capacidade que o `README.md` cita | |

As três últimas linhas da coluna da esquerda são responsabilidade específica do
`README.md`, e ele é o único documento **executável na prática**: alguém segue os passos
dele em uma conta AWS de verdade. Quando um script de `deploy-aws/` muda e o `README` não,
o defeito só aparece na próxima instalação, quando já custou caro.

Na `main`, documento e código nunca divergem. Dentro da branch eles podem estar à frente do
que está publicado, porque a branch é espaço de trabalho e os dois avançam em par: se ela
morrer no meio, nada inconsistente chegou à `main`; se for mesclada, chega tudo junto por
construção.

---

## 8. Pull request

Toda descrição de PR tem duas seções obrigatórias, **Resumo das mudanças** e **Análise de
produtividade com IA**, com o formato e o modo de preencher cada campo definidos em
`CLAUDE.md`.

No resumo, toda mudança que implementa ou altera uma regra de negócio cita o código
`RN-XXX` dela, e toda mudança originada de feedback referencia a issue que a originou, com
`Closes #N`. Essa referência é o que permite, meses depois, responder por que uma regra
existe apontando para a frase de uma pessoa real que sentiu o atrito.

**Se um merge estiver bloqueado, pare e reporte.** Não se contorna a proteção de branch,
mesmo tendo direito administrativo para isso: a regra de proteção é a camada real de
garantia, e contorná-la em silêncio anula o motivo de ela existir.

---

## 9. Release

O fluxo completo de nove passos, da propagação da versão até a publicação do GitHub
Release, está em `CLAUDE.md` § Política de versionamento, e a estratégia em três camadas
está em `architecture-guide.md` § Estratégia de versionamento.

Dois pontos que pertencem ao processo e não à política:

- **A branch de um ciclo é `release/vX.Y.Z`**, e o commit de incremento de versão entra
  nela, não em uma branch separada.
- **Ao cortar a versão**, as issues entregues no ciclo são fechadas com referência ao PR, e
  as que ficaram para trás recebem a versão alvo seguinte no Project. Uma issue aceita que
  ninguém reavaliou no fim do ciclo é uma promessa silenciosa a quem a reportou.

---

## 10. O que nunca entra em `docs/`

| Isto | Vai para |
|---|---|
| Hipótese de necessidade, pedido, atrito relatado | Issue `feedback` |
| Escopo em discussão, alternativa em avaliação | Issue `proposta` |
| Roadmap, ordem de construção, versão alvo | Project |
| Risco ainda não endereçado | Issue `risco` ou `risco-tecnico` |
| Questão não decidida | Issue `questao` |
| Histórico de mudanças, nota de versão, data de revisão | `CHANGELOG.md` e o histórico do git |

A última linha é anterior a este processo e continua valendo com a mesma força: rodapés do
tipo "documento para uso interno, última revisão X, versão Y" são proibidos em qualquer
arquivo de `docs/`. Eles duplicam o que o git já registra, saem de sincronia
imediatamente, e acrescentam ruído que o leitor precisa filtrar.
