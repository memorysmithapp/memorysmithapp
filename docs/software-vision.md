# Visão de Software: Plataforma MemorySmith.app

Este documento é a fonte da verdade para **o que o produto faz e sob qual regra**. Descreve visão, linguagem ubíqua, modelo de negócio de assinaturas, papéis, entidades de domínio, regras de negócio (`RN-XXX`), o contrato público de MCP, as telas e o recorte de cada versão.

As regras de negócio são numeradas `RN-{CONTEXT}-{NNN}`, em que `CONTEXT` é o prefixo do bounded context a que a regra pertence (§6). Os códigos são **append-only**: nunca são renumerados nem reutilizados, e uma regra que deixou de valer é marcada como removida na própria linha, preservando o número. O momento em que um número é reservado está em [`development-process.md`](development-process.md) §6.

Para fatos gerais do domínio (Markdown, MCP, auditoria, LGPD), ver [`knowledge-base.md`](knowledge-base.md). Para como o produto é construído (chaves, transações, adaptadores, infraestrutura), ver [`architecture-guide.md`](architecture-guide.md). Este documento **não repete** o conteúdo daqueles dois: referencia por seção.

---

## Índice

1. [Visão do produto](#1-visão-do-produto)
2. [Princípios de produto](#2-princípios-de-produto)
3. [Linguagem ubíqua](#3-linguagem-ubíqua)
4. [Plataforma e assinaturas](#4-plataforma-e-assinaturas)
5. [Papéis e permissões](#5-papéis-e-permissões)
6. [Mapa de domínios](#6-mapa-de-domínios)
7. [Domínio: Access](#7-domínio-access)
8. [Domínio: Knowledge](#8-domínio-knowledge)
9. [Domínio: Agent Access (o contrato público)](#9-domínio-agent-access-o-contrato-público)
10. [Domínio: Discovery](#10-domínio-discovery)
11. [Domínio: Audit](#11-domínio-audit)
12. [Domínio: Portability](#12-domínio-portability)
13. [Interface da aplicação](#13-interface-da-aplicação)
14. [Limites do produto](#14-limites-do-produto)
15. [Onde vivem o recorte de versão, os riscos e as questões em aberto](#15-onde-vivem-o-recorte-de-versão-os-riscos-e-as-questões-em-aberto)

---

## 1. Visão do produto

### 1.1 O problema

O foco desse software é potencializar a **eficiência e eficácia da relação humano e agentes de IA** independentemente da plataforma de IA escolhida e o tamanho do time de humanos.

**A memória do trabalho fragmenta em duas direções ao mesmo tempo.** Um time toca um projeto: uma auditoria, um processo regulatório, uma pesquisa, uma obra, o lançamento de um produto. Nada disso precisa ser software. Cada pessoa toca a parte dela acompanhada de um agente, e não existe uma plataforma de IA do time: uma trabalha no Claude, outra no ChatGPT, uma terceira no assistente embutido na ferramenta que ela já usava. A escolha é pessoal, muda com o tempo e não há por que uniformizá-la. Essa diversidade não seria problema se existisse uma camada comum de retenção. Sem ela, a memória se parte em duas dimensões simultâneas:

1. **Pelo tempo, a sessão.** A memória do agente termina quando a sessão termina, e a conversa seguinte começa do zero, sabendo do assunto apenas o que couber na janela daquela vez.
2. **Pelo fornecedor, o silo.** O que uma plataforma retém a respeito de quem a usa pertence àquela plataforma e àquela pessoa, não sai de lá e nenhum agente de mais ninguém a lê.

Somadas, as duas produzem tantas memórias parciais e privadas quantas forem as pessoas multiplicadas pelas plataformas, sobre um trabalho que é um só. O que o time sabe de verdade continua espalhado em conversa, documento, planilha, thread de decisão e na cabeça de quem participou.

**O custo não aparece como arquivo perdido. Aparece como três gargalos operacionais:**

1. **Retrabalho por reconstrução de contexto.** Toda tarefa recomeça pela reconstrução do contexto, e a pessoa gasta mais tempo redescrevendo ao agente o que o time já havia decidido, um pouco diferente a cada vez, do que executando o trabalho.
2. **Divergência de premissas.** Duas pessoas descrevem o mesmo fato de dois jeitos aos seus agentes, e não existe ponto central onde conferir qual das duas versões é a que vale.
3. **Erosão da confiança.** O resultado volta desacompanhado da fonte. Conferir custa mais do que aceitar, aceita-se sem conferir, e é isso que corrói a confiança em tudo que a base passa a conter.

**As quatro práticas que descrevem a fluência de quem trabalha com IA degradam todas pela mesma causa raiz:** a ausência de um corpo de conhecimento compartilhado, persistente e legível pelos dois lados (*Delegation*, *Description*, *Discernment* e *Diligence*, detalhadas em `knowledge-base.md` §4.4). Sem ele, delega-se a redigitação de contexto em vez da tarefa, descreve-se o mesmo cenário de novo a cada sessão, avalia-se a resposta por plausibilidade em vez de por fonte, e não sobra rastro para responder pelo que foi produzido. Daí a exigência dupla que atravessa o produto: a base precisa ser **barata de escrever**, porque quem mais escreve nela é o agente durante o trabalho, e **barata de ler**, porque a pessoa precisa curar e decidir sem trocar de ferramenta.

**O que falta é uma fonte única da verdade, comum às pessoas e aos agentes**, que persista além da sessão e não pertença a nenhuma plataforma. Ela se constrói em três movimentos encadeados:

1. **Capturar com evidência.** Norma, legislação, documentação técnica, pesquisa, decisão tomada em reunião. O que entra registra de onde veio e quem o escreveu, humano ou agente, porque afirmação que não se rastreia até a fonte não sustenta decisão depois.
2. **Curar.** Material capturado ainda não é conhecimento. Alguém precisa julgar o que vale, reconciliar o que se contradiz, ligar o novo ao que já existia e enxergar o que está maduro e o que ainda é rascunho. Curadoria é trabalho humano assistido por agente, nunca subproduto automático da ingestão.
3. **Servir aos dois lados com o mesmo material.** A base é fonte da verdade para o agente, que a lê a cada tarefa em vez de adivinhar, e superfície de trabalho para a pessoa, que aprende com ela, corrige o que está errado e decide com ela à vista. Dois leitores com exigências diferentes sobre exatamente o mesmo conteúdo.

**Essa fonte é viva.** Ela não é o relatório escrito no fim nem o documento congelado no começo: cresce e se corrige enquanto o projeto anda, e a versão de hoje não é a de duas semanas atrás. Isso é a característica, não o defeito, e é o que impõe a última exigência: a base precisa dizer o que dizia na data em que alguém decidiu apoiado nela.

**Os arranjos improvisados de centralização falham por atacado**, porque tratam a base como repositório passivo de arquivos e ignoram o que a colaboração entre pessoas e agentes exige:

1. **Monólito de informação, sem granularidade.** Concentrar o conhecimento em documentos extensos cobra dos dois lados. Para a pessoa, a busca e a leitura ficam lentas e inflexíveis. Para o agente, texto longo lota a janela de contexto com ruído, dificulta localizar a evidência e impede ligar com precisão conceito, decisão e referência (`knowledge-base.md` §4.1 e §5.3).
2. **Formato proprietário e rigidez visual.** Documento formatado para apresentação, como PDF, apresentação e planilha complexa, dificulta extrair e escrever contexto estruturado, e bloqueia a interconexão entre informações (`knowledge-base.md` §1.4).
3. **Acesso incompatível com agente.** Sem conector padronizado, o agente não navega pela rede de informações, não consulta dependência, não valida metadado e não escreve na base de forma autônoma e segura (`knowledge-base.md` §3.1).
4. **Ausência de metadado de governança.** Falta a camada de instrução que diz a pessoas e agentes como ler e como atualizar o conteúdo, e faltam data, maturidade (rascunho ou consolidado) e autoria explícita de cada trecho. Sem isso a base vira amontoado, e amontoado induz erro, alucinação e perda de rastreabilidade (`knowledge-base.md` §2.3 e §7.3).

**O arranjo que mais se aproxima disso hoje, e onde ele para.** O fluxo que já funciona é uma pasta local de arquivos `.md`, com um documento na raiz explicando ao agente como escrever nela, e um editor de vault por cima para navegar. Ele acerta o essencial, o formato é legível pelos dois lados e a estrutura está declarada, mas é de uma pessoa só e trava em três pontos previsíveis (detalhamento em `knowledge-base.md` §2.5):

1. **Colaboração:** o conteúdo é local, e duas pessoas não trabalham no mesmo corpo de conhecimento.
2. **Navegação compartilhada:** editores de vault são clientes locais, ruins como cliente de repositório remoto.
3. **Múltiplos cofres:** separar assuntos exige pastas soltas, sem um lugar que as liste.

A esses três se soma o que a pasta local nunca teve e que os movimentos de curar e decidir exigem para valer: registro de quem escreveu cada coisa, quando, e com qual agente.

### 1.2 A solução

**Cofres de conhecimento em Markdown, com estrutura declarada, acessíveis nativamente pelas ferramentas de IA.**

O MemorySmith.app é a infraestrutura remota de conhecimento que sustenta a persistência de contexto: Vaults em Markdown puro, com estrutura declarada, operáveis nativamente por agentes de IA e por pessoas. Ele é o backend remoto do fluxo que já funciona, porque mantém o formato (Markdown puro), mantém a prática (Guidance na raiz, Template por pasta) e resolve os três pontos em que a pasta local trava, acrescentando as quatro capacidades que nenhum arranjo improvisado tem:

- **Acesso remoto autenticado.** Um mesmo vault alcançado por vários clientes e agentes, sob identidade verificada (§4).
- **Colaboração com papéis.** Permissão por papel na assinatura e teto de papel por vault, valendo igual para pessoas e para agentes (§5).
- **Histórico auditável e imutável.** Cada mudança rastreável até quem a escreveu, com qual agente e o que a nota dizia antes (§11).
- **Descoberta relacional e por curadoria.** Grafo de links sobre notas atômicas, busca no texto do vault e facetas que mostram a distribuição do conteúdo (§10).

#### Interoperabilidade por protocolo

Contra a fragmentação por fornecedor o produto age na camada de protocolo, e não pela adesão a uma ferramenta proprietária: o vault é servido por um MCP server remoto, e MCP é padrão aberto falado por clientes de fabricantes diferentes (`knowledge-base.md` §3.5). Cada pessoa continua na plataforma de IA que prefere, e todas alcançam o mesmo vault, com o mesmo conteúdo, sob o mesmo papel e na mesma versão da verdade.

#### O conceito

O nome diz o resto. Uma forja não guarda metal, ela o trabalha: o material bruto, que aqui são dados, normas e decisões, entra e sai peça, batido e conferido enquanto está quente. É esse o papel do produto sobre a memória do time, que é forjada durante o trabalho, por pessoas e agentes sobre o mesmo material, e não transcrita depois que o trabalho acabou.

### 1.3 O ciclo de uso

O agente atua nos dois sentidos: lê o vault e o **alimenta**. Os três movimentos de §1.1 aparecem aqui como o caso concreto que o produto serve:

1. **Ingestão.** O agente lê um corpo de material bruto, como normas, legislação, documentação técnica ou pesquisa, e o converte em notas granulares dentro do vault, obedecendo ao Guidance (o que este vault é), à estrutura de pastas (onde cada coisa vai) e ao Template da pasta (como a nota se estrutura). Cada escrita registra quem a fez, com qual agente e o que a nota dizia antes (§11).
2. **Curadoria.** Pessoas revisam o que entrou e conduzem as correções, e a interface é onde elas leem: a nota e a estrutura como o agente as recebe, a distribuição do vault pelo painel de curadoria (§10.3) e a contagem de links pendentes e de notas órfãs no catálogo (§13).
3. **Consumo.** Depois, em outro momento do projeto, como uma auditoria, um parecer ou um relatório, agentes e pessoas usam o mesmo vault como fonte única da verdade para fundamentar o que entregam.

**Três princípios que o ciclo impõe ao produto inteiro:**

- **A escrita via protocolo é o caminho primário de ingestão.** Quem popula o vault é o agente, por construção. Escrita não é funcionalidade secundária exposta pela API interna.
- **Guidance, estrutura de pastas e Template são instruções executáveis, não documentação** (`knowledge-base.md` §4.2). São o que faz o agente escrever a nota certa, na pasta certa, no formato certo. Um Guidance fraco ou uma descrição de pasta vaga degrada a qualidade do que entra, e o efeito só aparece depois, no consumo.
- **Governança e proveniência são de projeto.** O vault sustenta trabalho regulado e auditável, então autoria e rastreabilidade temporal são premissa do sistema (§11), e não conformidade acrescentada depois.

### 1.4 A tese, em uma frase

O produto não é guardar `.md`, é **entregar contexto estruturado ao agente sem atrito**. Se consultar um vault hospedado custar mais esforço que ler uma pasta local, a proposta de valor está comprometida. Por isso o MCP não é acessório: é a camada primária de integração, e a API interna existe para servir a interface.

O pilar complementar da mesma tese é a leitura e a curadoria humanas. Uma base que a pessoa não consegue navegar e validar deixa de ser curada, e uma base sem curadoria perde a capacidade de servir como fonte confiável ao agente (§13).

### 1.5 Proposta de valor

| Público-alvo | A dor central | O que o produto entrega |
|---|---|---|
| Quem trabalha com agente sobre um corpo de conhecimento | Os arranjos improvisados são estáticos, isolados ou caros de consultar | Vault remoto em Markdown puro, conectado nativamente ao cliente de IA |
| Time que trabalha com agentes todo dia | A cada nova sessão o contexto precisa ser reconstruído à mão | Memória comum entre pessoas e agentes, escrita durante o trabalho e lida a cada tarefa |
| Time em que cada um usa a plataforma de IA que prefere | O silo por fornecedor impede compartilhar o contexto | Um MCP server remoto: o mesmo vault, com o mesmo papel, em qualquer cliente que fale o protocolo |
| Times que compartilham uma base | Sincronizar arquivos não resolve edição concorrente nem controle de acesso | Assinatura com papéis e escrita com detecção de conflito |
| Trabalho regulado (auditoria, jurídico, compliance) | Não se demonstra quais premissas fundamentaram um parecer passado | Histórico por revisão, autoria de humano e de agente, trilha imutável |
| Quem tem muitos assuntos | Pastas soltas, sem catálogo | Catálogo de vaults com descrição, cada um autônomo |
| Quem teme lock-in | A base é ativo de longo prazo, e formato proprietário a prende | Export de `.md` puros, sem formato proprietário |
| Quem tem exigência de soberania sobre onde o dado mora | Hospedar em terceiro é decisão que não depende só de tecnologia | O backend inteiro roda na conta AWS de quem instalou, com o mesmo código (§4.9) |

### 1.6 Slogan

**Structured knowledge, natively readable and writable by humans and agents.**

---

## 2. Princípios de produto

Decisões que valem para o produto inteiro e a que qualquer funcionalidade nova precisa responder. Os princípios de engenharia correspondentes estão em `architecture-guide.md` §2.

| # | Princípio | Consequência prática |
|---|---|---|
| **PP1** | **No fim é tudo Markdown** | O backend organiza e serve; não gera Markdown a partir de esquema tipado, e não impõe estrutura ao conteúdo |
| **PP2** | **Vault autônomo** | Cada vault se descreve no próprio Guidance. Sem herança entre vaults e, portanto, sem link entre vaults |
| **PP3** | **Molde é sugestão, não contrato** | O Template orienta a escrita; a nota não é obrigada a segui-lo, e o servidor não valida contra ele |
| **PP4** | **O backend não interpreta o conteúdo** | O que vai dentro da nota, frontmatter inclusive, é decidido pelo Guidance e pelo Template. O backend lê apenas sintaxe universal de Markdown (link, heading), nunca convenção de vault. As duas exceções sancionadas vivem em projeções do Discovery: o extrator de links e o de facetas (§10.3), que agregam sem atribuir significado e nunca alimentam regra do core |
| **PP5** | **Descoberta é derivada** | Grafo, busca e facetas nunca são fonte da verdade; são reconstruíveis a partir dos `.md` |
| **PP6** | **O passado é imutável** | Apagar uma nota não destrói o histórico. Destruir conteúdo é ato administrativo registrado, nunca efeito colateral |
| **PP7** | **Portável por construção** | Export devolve `.md` puros numa árvore de arquivos legível, sem formato proprietário |
| **PP8** | **Modelo completo, interface progressiva** | Assinatura, papéis e vínculos existem desde a primeira linha; a UI só mostra cada um quando o usuário chega no caso que o exige |
| **PP9** | **Ordem é sinal, não enfeite** | A ordem de pastas e de notas é conteúdo: é ela que diz ao agente por onde começar. Por isso é editável e é preservada até no export |
| **PP10** | **Erro é interface** | Toda recusa devolvida ao agente precisa dizer o que fazer em seguida: argumento faltante devolve as opções válidas, e conflito devolve o conteúdo atual |

---

## 3. Linguagem ubíqua

Termo único por conceito, do código ao produto. Divergência aqui é o começo de todo modelo anêmico. Estes termos aparecem em inglês no código exatamente como estão na coluna "Termo".

| Termo | Significa | **Não** confundir com |
|---|---|---|
| **Subscription** | A assinatura: fronteira de isolamento, unidade de colaboração, unidade de cobrança e raiz de tudo. Tem um titular, membros e um estado | Conta de usuário |
| **Platform Admin** | Quem opera a plataforma e autoriza assinaturas. **Não é papel dentro de assinatura alguma** e não alcança conteúdo | Owner, administrador do cliente |
| **Owner** | O titular da assinatura: responsável pelo pagamento, convida e remove membros, edita tudo. Um por assinatura | Editor com muitos direitos |
| **Vault** | Um cofre de conhecimento autodescrito | Repositório, pasta raiz |
| **Guidance** | O **papel** de "para que serve este vault e como estruturar as notas", desempenhado por um documento apontado pelo vault | Um arquivo chamado `GUIDANCE.md` |
| **Folder** | Nó ordenado da árvore do vault, com `description` que diz *o que se guarda ali*. A descrição é atributo da pasta, nunca um Content Slot | Diretório físico (não existe), documento de pasta |
| **Template** | O **papel** de "leiaute sugerido das notas desta pasta", desempenhado por um documento apontado pela pasta | Esquema, validação, um arquivo chamado `TEMPLATE.md` |
| **Note** | Um documento Markdown; o que vai dentro dele é decidido pelo Guidance e pelo Template | Registro, entidade tipada |
| **Position** | Chave que ordena irmãos: pastas entre pastas, notas dentro da pasta | Índice denso, campo `order` |
| **Link** | Referência de uma nota a outra, extraída do Markdown | Hyperlink externo |
| **Edge** | Link já resolvido para um `NoteId` de destino | Link pendente |
| **Pending Link** | Link cujo alvo ainda não existe; resolve sozinho quando a nota alvo for criada | Link quebrado |
| **Facet** | Atributo de frontmatter agregável para curadoria: os padrão `maturity` e `reviewed`, mais os que o Guidance do vault definir, descobertos pela forma do valor | Campo tipado do backend, esquema de nota |
| **Authorship** | Quem escreveu: o humano **e** o agente usado | Usuário logado |
| **Revision** | O conteúdo exato de uma nota num instante | Evento, alteração |
| **Audit Event** | Registro append-only do que aconteceu, com autoria e revisão | Log de aplicação |
| **Vault Context** | Documento composto (Guidance mais árvore anotada) entregue ao agente. É derivado a cada chamada e nunca armazenado | Dump do vault, documento que alguém edita |
| **Content Slot** | Um documento Markdown armazenado, endereçado por identificador opaco. Nota, guidance e template são o **mesmo** tipo de coisa; o que difere é quem aponta para ele | Arquivo, caminho |
| **Content Role** | O significado atribuído a um slot: `body` (nota), `guidance` (vault) ou `template` (pasta) | Nome de arquivo reservado |
| **Vínculo** | A relação `(usuário, assinatura)` que autoriza aquele usuário a atuar naquela assinatura | Membership |
| **Assinatura Ativa** | A assinatura em cujo nome a sessão age agora, escolhida entre os vínculos | O conjunto das assinaturas do usuário |
| **Membership** | A relação `(usuário, assinatura)` com papel `EDITOR` ou `VIEWER` | Vínculo, que diz apenas que o usuário alcança a assinatura |
| **Vault Role Limit** | O teto de papel de um membro num vault específico. Só rebaixa, nunca promove | Papel próprio do vault |

---

## 4. Plataforma e assinaturas

### 4.1 Visão geral do modelo

A assinatura não é uma feature: é a forma do produto. Um cliente é uma **Subscription**, e dentro dela pessoas colaboram nos **Vaults**.

```
Subscription  (fronteira de isolamento, colaboração, cobrança e identidade: um titular, membros, um estado)
└── Vault  (o conhecimento em si, autônomo, PP2)
    ├── Guidance
    └── Folder (ordenada, com descrição)
        ├── Template
        └── Note (ordenada)
```

**Acima da assinatura existe apenas a plataforma**, operada pelo `PLATFORM_ADMIN`. Ela não é um nível da hierarquia de dados: é uma superfície separada, que autoriza assinaturas e nunca alcança conteúdo (§4.6).

### 4.2 A assinatura é a fronteira, o status é o estado

A assinatura acumula dois papéis que normalmente ficam separados: é o objeto de negócio (quem paga, em que plano, com qual status) **e** a fronteira de isolamento de todos os dados. Isso só é seguro sob uma regra:

> **O `SubscriptionId` é perpétuo.** Ele é emitido uma vez, nunca é reemitido e nunca muda, independentemente de a assinatura estar pendente, ativa, suspensa ou cancelada. Cancelar altera um campo de status; não move, não re-chaveia e não apaga nada. Recontratar reativa **a mesma assinatura**, com o mesmo identificador, e todos os dados voltam a ser alcançáveis exatamente onde estavam.

Sem essa regra, "cancelar" viraria migração de dados e "recontratar" viraria importação, e a fronteira de isolamento passaria a depender de um estado que muda. Com ela, o status controla **acesso**, nunca **endereço**.

**A assinatura não tem nome** (RN-SUB-020): o que a identifica é o `SubscriptionId`, e quem responde por ela é o titular. Um nome seria mais um campo a manter em dia sem nada que o mantivesse honesto, e não distinguiria nada que o e-mail do titular já não distinga.

Além do status, a assinatura declara **o que ela é e quanto ela pode guardar**: um `type`, que nesta fase só pode ser `individual`, e uma `quota` de armazenamento, que é `500MB`, `1GB` ou `2GB` (RN-SUB-018, RN-SUB-019). Os dois são escolhidos no momento da solicitação e são alteráveis depois por ato do `PLATFORM_ADMIN`.

A quota **é aplicada** (RN-SUB-021). O que ela mede é o **conteúdo vigente**: a revisão atual de cada nota não apagada, mais cada `Guidance` e cada `Template`. Revisões substituídas continuam guardadas, porque apagar bytes é ato administrativo com porta própria, e deliberadamente não entram na conta: cobrar por elas faria o uso subir a cada edição e nunca descer, e apagar uma nota não devolveria nada. Um vault na lixeira continua ocupando o que ocupa, pelo mesmo motivo, e porque ele volta inteiro quando é restaurado.

O que a quota recusa é apenas o que **faz crescer** o conteúdo vigente. Criar nota, aumentar o texto de uma, gravar um `Guidance` maior e restaurar uma nota apagada são recusados com `LIMIT_EXCEEDED` quando não cabem; ler, apagar, mover, reordenar e encurtar continuam funcionando mesmo acima do teto. A razão é simples: um limite que congela tudo prende a pessoa dentro dele, sem conseguir encurtar a própria nota que a levou até lá.

### 4.3 Hierarquia e por que ela tem dois níveis

| Nível | Quem manda | Existe para |
|---|---|---|
| **Subscription** | `OWNER` (um, o titular) e os membros `EDITOR` · `VIEWER` | Isolamento, colaboração, cobrança, domínio de identidade |
| **Vault** | herda o papel da assinatura, com teto opcional (§5.3) | O conhecimento em si |

**Decisão consciente, com um custo declarado.** Existiu um terceiro nível entre os dois, o workspace, e ele foi removido. Ele resolvia um caso: dois times do mesmo cliente que não devem se ver. Sem ele, quem é membro da assinatura alcança todos os vaults dela, e a única granularidade que sobra é o teto por vault, que rebaixa a escrita mas nunca esconde. Separar dois grupos passa a exigir **duas assinaturas**, e portanto duas cobranças. O custo foi pesado e aceito: um nível a menos vale mais para quem usa o produto sozinho ou em time único, que é o caso que o produto atende primeiro, do que a granularidade valeria para o caso que ele ainda não atende.

### 4.4 Onboarding e ciclo de vida da assinatura

Não há processamento automático de pagamento nesta fase. A ativação é um **ato administrativo** do `PLATFORM_ADMIN`, o que mantém o modelo completo enquanto a cobrança não existe.

| Momento | O que acontece |
|---|---|
| **Signup** | Cria a conta de usuário. Nenhuma assinatura ainda, nenhum acesso operacional. Não há cadastro aberto nesta fase: a conta nasce por ato da operação da plataforma |
| **Onboarding** | O usuário solicita uma assinatura, escolhendo tipo e quota, e passa a ser o `OWNER` dela. Status: `pending_approval` |
| **Autorização** | Um `PLATFORM_ADMIN` aprova (status vira `trial` ou `active`) ou rejeita, com motivo obrigatório |
| **Configuração** | O `OWNER` cria vaults e escreve Guidance e Templates |
| **Convite** | O `OWNER` emite um convite endereçado a um e-mail, definindo `EDITOR` ou `VIEWER`. O produto não entrega o convite: quem convida repassa o link por onde quiser |
| **Aceite** | O convidado ganha vínculo com aquela assinatura. **Não cria assinatura própria e não paga nada** |
| **Saída** | Remover um membro revoga o acesso; a conta, os demais vínculos e a autoria do que ele escreveu permanecem |
| **Suspensão / cancelamento** | Acesso operacional cessa; os dados permanecem sob a mesma chave (§4.2) |

**Estados da assinatura:**

```
                    ┌──────────────┐
   onboarding ─────▶│pending_approval│
                    └───┬────────┬─┘
              aprovação │        │ rejeição (motivo obrigatório)
                        ▼        ▼
             ┌───────────────┐  ┌──────────┐
             │ trial │ active│  │ rejected │──▶ pode solicitar de novo
             └───┬───────────┘  └──────────┘
                 │
                 ├──▶ suspended  ──▶ volta para active
                 └──▶ canceled   ──▶ volta para active (mesma assinatura, §4.2)
```

### 4.5 Um usuário, mais de uma assinatura

Quem faz onboarding é titular da sua assinatura; quem aceita convite de outra organização passa a participar de uma segunda. Como a assinatura é a fronteira de isolamento, isso não é detalhe de interface.

- **Identidade é global; assinatura é vínculo.** A conta de usuário não pertence a assinatura nenhuma. A participação é uma relação com papel próprio em cada uma.
- **A assinatura ativa é escolhida, não deduzida.** A sessão age em nome de uma assinatura por vez, e trocar é ação explícita.
- **O conector MCP fixa a assinatura no consentimento.** Ela entra no acesso do conector no instante em que o usuário autoriza e não muda durante a vida daquele acesso. Sem essa regra, um agente com sessão longa trocaria de assinatura no meio de um trabalho de ingestão, e a metade já escrita ficaria no lugar errado. Um conector, uma assinatura; quem trabalha em duas autoriza dois conectores.

### 4.6 A plataforma é uma superfície separada

O `PLATFORM_ADMIN` opera a plataforma: aprova, rejeita e suspende assinaturas. **Ele não é papel dentro de assinatura alguma** e, por construção, não alcança conteúdo:

> Uma sessão de plataforma **não carrega assinatura ativa**. Como toda chave de dado do sistema começa pela assinatura, não há chave que uma credencial de admin consiga montar. A impossibilidade é estrutural, não uma verificação que alguém precisa lembrar de escrever.

O que ele vê é metadado de assinatura: titular, e-mail, status, tipo, quota, datas e contagem de membros. Nunca nome de vault, nunca conteúdo de nota.

Ele conta ainda com **duas operações administrativas**, que existem para operar um ambiente e não para o fluxo de revisão: definir o status diretamente, sem passar pela máquina de transição de §4.4, e mudar tipo e quota (RN-SUB-018, RN-SUB-019). As duas são registradas como eventos próprios, distintos dos eventos de aprovação, rejeição, suspensão e reativação, justamente porque não foram o caminho comum: a trilha precisa dizer qual dos dois aconteceu.

Se um `PLATFORM_ADMIN` também for usuário de alguma assinatura, ele age ali como qualquer outro membro, com sessão própria. Os dois papéis nunca se somam na mesma sessão.

### 4.7 Interface progressiva (PP8)

**A UI esconde a lista de membros enquanto houver só o titular, e esconde a troca de assinatura enquanto houver um só vínculo.** O modelo é completo desde o começo, e a interface é que aparece por etapas.

### 4.8 Regras de negócio: assinatura e isolamento

- **RN-SUB-001:** Todo dado do sistema pertence a exatamente uma assinatura; não existe dado compartilhado entre assinaturas.
- **RN-SUB-002:** A assinatura sob a qual uma requisição opera é determinada pela credencial autenticada, nunca por parâmetro de requisição.
- **RN-SUB-003:** Nenhuma consulta pode retornar dados de mais de uma assinatura. Duas perguntas atravessam a fronteira e são as únicas: *"de quais assinaturas este usuário participa?"* e a listagem administrativa de assinaturas por status. Nenhuma das duas revela conteúdo.
- **RN-SUB-004:** Um recurso de outra assinatura é indistinguível de um recurso inexistente: ambos respondem `NOT_FOUND`.
- **RN-SUB-005:** O `SubscriptionId` é perpétuo: emitido uma vez, nunca reemitido, imutável ao longo de todas as transições de status. Cancelamento e reativação usam o mesmo identificador.
- **RN-SUB-006:** O signup cria apenas a conta de usuário. Nenhuma assinatura é criada automaticamente e nenhum acesso operacional é concedido.
- **RN-SUB-007:** Uma assinatura em `pending_approval`, `rejected`, `suspended` ou `canceled` não concede acesso operacional a ninguém, nem ao próprio `OWNER`, nem por MCP.
- **RN-SUB-008:** Somente `PLATFORM_ADMIN` aprova, rejeita, suspende ou reativa assinaturas.
- **RN-SUB-009:** A rejeição exige motivo, que é comunicado ao solicitante; ele pode solicitar novamente.
- **RN-SUB-010:** A aprovação define o status como `trial` ou `active`, a critério do `PLATFORM_ADMIN` conforme o acordo comercial.
- **RN-SUB-011:** Um usuário pode ter vínculo com múltiplas assinaturas; exatamente uma é a assinatura ativa da sessão.
- **RN-SUB-012:** Um dos vínculos é marcado como padrão e é assumido quando nenhuma assinatura ativa válida é encontrada.
- **RN-SUB-013:** Trocar de assinatura ativa é ação explícita do usuário; nenhuma operação de negócio recebe a assinatura como argumento.
- **RN-SUB-014:** Um conector MCP autorizado opera sempre na assinatura fixada no momento do consentimento, pela vida inteira daquela autorização.
- **RN-SUB-015:** Índices derivados (busca, grafo, facetas, cache) respeitam a mesma fronteira de assinatura que o dado de origem.
- **RN-SUB-016:** Uma sessão de `PLATFORM_ADMIN` não carrega assinatura ativa e, portanto, não alcança nenhum dado de vault ou nota.
- **RN-SUB-017:** Aceitar um convite não cria assinatura para o convidado: ele passa a atuar na assinatura de quem convidou.
- **RN-SUB-018:** Toda assinatura declara um `type`, escolhido na solicitação, cujo único valor nesta fase é `individual`. Somente `PLATFORM_ADMIN` altera o tipo depois, e é ele também quem pode definir o status diretamente, sem seguir a máquina de transição de §4.4. Um status definido assim é registrado como evento próprio, e definir `rejected` por esse caminho não cumpre RN-SUB-009: rejeitar uma solicitação que alguém aguarda continua exigindo motivo.
- **RN-SUB-019:** Toda assinatura declara uma `quota` de armazenamento, escolhida na solicitação entre `500MB`, `1GB` e `2GB`, e alterável depois por `PLATFORM_ADMIN`. Ela é aplicada nos termos de RN-SUB-021. *(Até a 0.2.0 esta regra dizia que a quota era declarada e não aplicada.)*
- **RN-SUB-021:** A `quota` de RN-SUB-019 é aplicada sobre o **conteúdo vigente** da assinatura: a revisão atual de cada nota não apagada, somada a cada `Guidance` e cada `Template`. Revisões substituídas permanecem armazenadas e não são contadas. Uma escrita que aumente esse total é recusada com `LIMIT_EXCEEDED` quando o total resultante ultrapassaria a quota; uma escrita que o reduza ou o mantenha é sempre aceita, inclusive acima do teto. A contagem é mantida fora da transação de escrita e é, portanto, levemente atrasada: a assinatura pode terminar pouco acima do teto, nunca indefinidamente acima dele.
- **RN-SUB-020:** A assinatura não tem nome. Ela é identificada pelo `SubscriptionId`, e para quem a opera ela é reconhecida pelo e-mail do titular. Nenhuma tela, rota, evento ou item de armazenamento carrega um nome de assinatura.

---

### 4.9 Modos de operação

O produto opera em **dois modos sobre o mesmo código**, e o que muda entre eles não é funcionalidade: é quem ocupa cada papel.

No **serviço hospedado**, o `PLATFORM_ADMIN` é a operação do produto, e a quota da assinatura é o limite comercial dela.

Numa **instalação própria**, quem opera a plataforma é quem instalou. O primeiro membro do grupo de administração nasce no onboarding da instalação, e apenas o primeiro. A quota deixa de ser limite comercial e passa a ser escolha de quem opera.

**Em nenhum dos dois há recurso retido.** Não existe bifurcação por edição em lugar nenhum do código, então o que roda no serviço hospedado é exatamente o que está no repositório, sob licença MIT. O caminho de instalação passo a passo vive no `README.md`, e não aqui.

---

## 5. Papéis e permissões

### 5.1 Taxonomia

Quatro papéis, em dois planos que nunca se misturam na mesma sessão:

| Papel | Plano | Concedido a | Quantidade |
|---|---|---|---|
| `PLATFORM_ADMIN` | Plataforma | Quem opera o serviço | Vários |
| `OWNER` | Assinatura | O titular, definido no onboarding | **Exatamente um por assinatura** |
| `EDITOR` | Assinatura | Convidado que escreve | Vários por assinatura |
| `VIEWER` | Assinatura | Convidado que só lê, inclusive revisor externo | Vários por assinatura |

Os três papéis de cliente são da **assinatura**. O `OWNER` alcança todos os vaults dela sem precisar ser convidado para cada um, e `EDITOR` e `VIEWER` alcançam todos os vaults com o papel que têm, até onde o teto de cada vault permitir (§5.3). Um usuário tem **um** papel por assinatura, e não um papel por recorte.

**Transferência.** O `OWNER` pode transferir a titularidade para outro membro da assinatura, e a partir daí ele passa a ser `EDITOR`. A assinatura nunca fica sem titular, porque a transferência é atômica e não é "remover e depois nomear".

### 5.2 Matriz de permissões

| Ação | `PLATFORM_ADMIN` | `OWNER` | `EDITOR` | `VIEWER` |
|---|:---:|:---:|:---:|:---:|
| Aprovar / rejeitar / suspender assinatura | ● | — | — | — |
| Ver metadados de assinaturas (titular, status, datas) | ● | ●¹ | — | — |
| Convidar membro, alterar papel, remover membro | — | ● | — | — |
| Definir o teto de papel de um membro num vault (§5.3) | — | ● | — | — |
| Transferir titularidade da assinatura | — | ● | — | — |
| Criar vault | — | ● | ● | — |
| Renomear / apagar vault | — | ● | — | — |
| Criar / editar / apagar nota | — | ● | ● | — |
| Criar / renomear / mover / reordenar pasta | — | ● | ● | — |
| Editar Guidance e Template | — | ● | ● | — |
| Mover nota entre vaults | — | ● | ●² | — |
| Ler vault, pastas, notas | — | ● | ● | ● |
| Buscar | — | ● | ● | ● |
| Ver grafo, backlinks e saúde do vault | — | ● | ● | ● |
| Ver histórico e atividade | — | ● | ● | ● |
| Exportar vault | — | ● | ● | — |

¹ Apenas da própria assinatura.
² Apenas quando o `EDITOR` alcança os dois vaults envolvidos com papel de escrita, o que inclui não estar rebaixado em nenhum deles (§5.3).

**A coluna do `PLATFORM_ADMIN` é quase toda vazia, e isso é a garantia, não uma lacuna** (§4.6). Ele opera a plataforma; o conhecimento dos clientes está fora do seu alcance por construção.

### 5.3 Teto de papel por vault

Uma assinatura pode conter vaults de sensibilidade diferente. Para isso o `OWNER` pode **rebaixar** o papel de um membro num vault específico.

**A permissão efetiva é sempre o menor entre o papel na assinatura e o teto do vault. Nunca promove.**

| Papel na assinatura | Teto no vault | Efetivo |
|---|---|---|
| `EDITOR` | — (nenhum) | `EDITOR` |
| `EDITOR` | `VIEWER` | `VIEWER` |
| `VIEWER` | — (nenhum) | `VIEWER` |
| `VIEWER` | `VIEWER` | `VIEWER` |
| `VIEWER` | `EDITOR` | **recusado**, porque o teto não promove |

Só existe um valor de teto: `VIEWER`. Não há "sem acesso", porque **quem é membro da assinatura enxerga todos os vaults dela**; o que o teto controla é escrever, não ver. Tirar um vault do alcance de alguém exige uma assinatura separada (§4.3), o que mantém a pergunta "quem vê o quê" respondível olhando só a lista de membros.

O teto não se aplica ao `OWNER`: ele é titular da assinatura e alcança tudo.

### 5.4 Regras de negócio do Access

- **RN-ACC-001:** Toda assinatura tem, em qualquer instante, exatamente um `OWNER`. Remover o `OWNER` é recusado; a única saída é a transferência de titularidade.
- **RN-ACC-002:** A transferência de titularidade é atômica: o novo titular vira `OWNER` e o anterior vira `EDITOR` na mesma operação.
- **RN-ACC-003:** O e-mail é único entre os membros de uma assinatura.
- **RN-ACC-004:** Um convite pendente não concede acesso; só o aceite cria o membro.
- **RN-ACC-005:** O convite é de uso único, vinculado ao e-mail que ele endereça, e expira em 7 dias.
- **RN-ACC-006:** Somente o `OWNER` convida, altera papel, remove membros e define tetos de vault. `EDITOR` não convida.
- **RN-ACC-007:** *(removida)* Tratava da criação, renomeação e remoção de workspaces. O nível de workspace deixou de existir (§4.3). O número é preservado e nunca será reaproveitado.
- **RN-ACC-008:** Um convite só pode ser emitido por assinatura em status `trial` ou `active`.
- **RN-ACC-009:** Remover um membro revoga o acesso à assinatura e preserva integralmente o que ele escreveu, incluindo a autoria registrada.
- **RN-ACC-010:** `VIEWER`, seja por papel de assinatura ou por teto de vault, recebe recusa em qualquer operação de escrita, tanto pela UI quanto pelo MCP.
- **RN-ACC-011:** O teto de papel por vault só rebaixa. Definir um teto maior que o papel do membro na assinatura é recusado com `VALIDATION`.
- **RN-ACC-012:** O único valor de teto admitido é `VIEWER`; não existe teto que remova a visibilidade do vault.
- **RN-ACC-013:** O teto de vault não se aplica ao `OWNER`.
- **RN-ACC-014:** Remover um membro da assinatura remove também todos os tetos de vault dele.
- **RN-ACC-015:** Toda decisão de autorização é tomada pelo serviço dono do recurso, combinando o papel do usuário na assinatura com o teto do vault.
- **RN-ACC-016:** Alterações de papel, de teto e remoções podem levar até 5 minutos para surtir efeito em sessões já autenticadas, porque a decisão do authorizer é cacheada por esse tempo.

---

## 6. Mapa de domínios

Seis bounded contexts. A separação é de responsabilidade e vocabulário; a forma de deploy é decisão de engenharia (`architecture-guide.md` §3 e §17).

| Contexto | Responsabilidade | Tipo | Prefixo `RN` |
|---|---|---|---|
| **Access** | Assinaturas e seu ciclo de vida, membros, papéis, tetos de vault, convites, vínculos, autorização | Supporting | `SUB`, `ACC` |
| **Knowledge** | Vaults, guidance, pastas, ordem, templates, notas | **Core** | `KNW` |
| **Discovery** | Grafo de links, índice de texto e facetas de curadoria, três projeções | Supporting | `DSC` |
| **Audit** | Trilha append-only: autoria, revisões, reconstrução por data | Supporting | `AUD` |
| **Agent Access** | O MCP server; compõe o Vault Context; traduz domínio ↔ tools | Supporting (camada anticorrupção) | `AGT` |
| **Portability** | Export para árvore de arquivos legível | Generic | `PRT` |

O prefixo é o do contexto a que a regra pertence. **Access carrega dois**, porque separa o que é da fronteira do que é de quem entra nela: `SUB` para a assinatura, seu ciclo de vida e o isolamento, `ACC` para membros, papéis, tetos e convites. Nenhum prefixo é aposentado quando um contexto muda de forma, porque os códigos já emitidos continuam referenciados.

**Knowledge é o core domain**, porque é onde está a regra que nenhum concorrente resolve de graça: estrutura declarada, ordem significativa, papéis de conteúdo e escrita concorrente barata. Todo o resto existe para servi-lo ou para transportá-lo.

**Discovery, Audit e Portability nunca são consultados pelo Knowledge.** Só o alimentam com o que ele publica. Essa direção única é o que permite reconstruí-los do zero (PP5).

---

## 7. Domínio: Access

### 7.1 Entidades

#### Entidade: `User` (identidade global)

```
id,                          -- identidade global; não pertence a assinatura alguma
email, name,
is_platform_admin (bool),    -- plano de plataforma; nunca se soma a papel de assinatura (§4.6)
created_at, last_login?
```

#### Entidade: `Subscription` (Agregado Raiz)

```
id,                          -- PERPÉTUO: emitido uma vez, nunca reemitido (RN-SUB-005)
                             -- não tem nome: quem a identifica é o id, e quem
                             -- responde por ela é o titular (RN-SUB-020)
owner_id,                    -- exatamente um, sempre presente (RN-ACC-001)
status (pending_approval | trial | active | rejected | suspended | canceled),
type (individual),           -- o que a assinatura é, comercialmente (RN-SUB-018)
quota (500MB | 1GB | 2GB),   -- aplicada sobre o conteúdo vigente (RN-SUB-019, RN-SUB-021)
requested_at,
reviewed_by_id?, reviewed_at?,
rejection_reason?,           -- obrigatório quando status = rejected (RN-SUB-009)
created_at,
members: [{
  user_id,
  email,                     -- único entre os membros da assinatura (RN-ACC-003)
  role (EDITOR | VIEWER),    -- OWNER não é membro: alcança tudo pela titularidade
  invited_by_id,
  joined_at
}]
```

O campo `status` controla **acesso**, nunca **endereço** (§4.2). Nenhuma transição de status move ou re-chaveia dado algum.

#### Entidade: `SubscriptionLink`, o vínculo (§4.5)

```
user_id, subscription_id,
is_owner (bool),
is_default (bool),
joined_at
```

#### Entidade: `VaultRoleLimit`, o teto por vault (§5.3)

```
vault_id, user_id,
limit (VIEWER),              -- único valor admitido (RN-ACC-012)
set_by_id, set_at
```

Vive junto do vault, não do membro: quem sabe quais vaults existem é o Knowledge, e a decisão de autorização precisa ser local (`architecture-guide.md` §14.2).

#### Entidade: `Invite`

```
id, subscription_id,
invitee_email,
invitee_role (EDITOR | VIEWER),
invited_by_id,               -- sempre o OWNER (RN-ACC-006)
token,                       -- uso único
status (pending | accepted | expired | revoked),
sent_at, expires_at, accepted_at?
```

### 7.2 Regras de negócio

As regras de Access estão em §5.4 (`RN-ACC-XXX`), junto da matriz de permissões e do teto por vault que elas governam. As regras de assinatura e isolamento estão em §4.8 (`RN-SUB-XXX`).

---

## 8. Domínio: Knowledge

O core. Quatro conceitos: o vault, a árvore de pastas, a nota e o conteúdo.

### 8.1 Entidades

#### Entidade: `Vault` (Agregado Raiz)

Fronteira de consistência: o vault e **toda a sua árvore de pastas**.

```
id, subscription_id,
name, slug,                  -- slug único na assinatura (RN-KNW-032)
description,                 -- o que aparece no catálogo de vaults
guidance_ref?,               -- ponteiro para o Content Slot que faz o papel de Guidance
version,                     -- controle de concorrência do agregado
created_by (Authorship), created_at, updated_at
```

#### Entidade: `Folder`, parte do agregado `Vault`

```
id, vault_id,
parent_folder_id?,           -- null = raiz do vault
name, slug,
description,                 -- OBRIGATÓRIA, de 1 a 500 caracteres: é ela que orienta o agente
position,                    -- ordem entre as pastas irmãs
template_ref?,               -- ponteiro para o Content Slot que faz o papel de Template
created_by (Authorship), created_at, updated_at
```

#### Entidade: `Note`, Agregado Raiz separado

```
id, vault_id, folder_id,
title, slug,
position,                    -- ordem dentro da pasta
body_ref,                    -- ponteiro para o Content Slot que faz o papel de body
created_by (Authorship),
updated_by (Authorship),
deleted_at?, deleted_by?,    -- soft delete
version                      -- controle de concorrência
```

`Note` é agregado próprio e não parte do `Vault`. A justificativa técnica está em `architecture-guide.md` §6.2; a consequência de produto é o que importa aqui: **escrever nota é barato e concorrente**, que é o caminho por onde o agente alimenta o vault.

#### Entidade: `ContentSlot` e `ContentRef`

Um Content Slot é um documento Markdown armazenado sob identificador opaco. **Nota, guidance e template são o mesmo tipo de coisa**; o que difere é quem aponta para ele e com qual papel.

```
ContentSlot:  content_id, subscription_id, created_at
ContentRef:   content_id, revision, sha256, bytes
```

| Papel (`Content Role`) | Apontado por | Campo |
|---|---|---|
| `body` | Nota | `body_ref` |
| `guidance` | Vault | `guidance_ref` |
| `template` | Pasta | `template_ref` |

Daí decorre a regra de produto mais contraintuitiva do sistema: **`GUIDANCE.md` e `TEMPLATE.md` não são nomes de arquivo, são papéis.** Não existe nome reservado no armazenamento. Nomes de arquivo só voltam a existir na borda, no export (§12) e na UI.

Quatro coisas parecidas convivem aqui, e confundi-las custa caro:

| O que é | Onde vive | Quem escreve |
|---|---|---|
| **Guidance** | Content Slot apontado por `guidance_ref`, com revisão e histórico | Um humano |
| **Descrição da pasta** | Atributo `description` da pasta, de 1 a 500 caracteres, sem revisão | Um humano |
| **Vault Context** | Nada: é composto a cada leitura (§9.2) | O produto, derivando |
| **`GUIDANCE.md`, `STRUCTURE.md`, `TEMPLATE.md`** | Só na borda: no export (§12) e nunca no armazenamento | O produto, materializando |

Nenhum desses nomes de arquivo aparece na interface nem na superfície MCP. Lá existem apenas o papel e o documento composto.

Isso torna triviais operações que de outro modo seriam código especial: promover uma nota a template da pasta, converter um template em nota, adotar o conteúdo de uma nota como guidance do vault. Todas são troca de ponteiro.

#### Valor: `Position`

A ordem de pastas e de notas é **conteúdo, não preferência de exibição** (PP9): é sinal para o agente sobre por onde começar e como o assunto se organiza. Por isso é editável, é preservada no Vault Context e sobrevive ao export.

Ordenação alfabética continua disponível como opção de exibição no cliente, sem alterar a ordem armazenada.

### 8.2 Regras de negócio: vault e estrutura

- **RN-KNW-001:** Todo vault pertence a exatamente uma assinatura, e a uma só.
- **RN-KNW-002:** O `slug` de uma pasta é único entre suas irmãs (mesmo pai, mesmo vault).
- **RN-KNW-032:** O `slug` do vault é único **dentro da assinatura**, porque é por ele que a interface endereça o vault. Criar um vault cujo nome gera um `slug` já usado devolve `ALREADY_EXISTS` **com o identificador do vault existente**, e nunca cria um segundo, pela mesma razão de RN-AGT-004: o servidor não gera sufixo automático. Renomear para um `slug` ocupado recebe a mesma recusa. Sem essa regra, dois vaults de mesmo nome dividem um endereço e o segundo fica inalcançável.
- **RN-KNW-003:** A profundidade máxima da árvore de pastas é 6 níveis.
- **RN-KNW-004:** Mover uma pasta nunca pode criar ciclo: o destino não pode ser descendente da origem.
- **RN-KNW-005:** Toda pasta tem uma `position` que a ordena entre as irmãs; toda nota tem uma `position` que a ordena dentro da pasta.
- **RN-KNW-006:** A `description` da pasta é obrigatória, entre 1 e 500 caracteres. Descrição vazia não é aceita, porque é ela que orienta a escrita do agente.
- **RN-KNW-007:** Remover uma pasta que contém pastas ou notas exige uma política explícita de remoção (`CASCADE` ou `REJECT_IF_NOT_EMPTY`). Não há padrão implícito.
- **RN-KNW-008:** Um vault tem no máximo um Guidance e uma pasta no máximo um Template; ambos são opcionais.
- **RN-KNW-009:** Renomear, reordenar ou mover pasta e nota nunca altera o conteúdo armazenado, apenas ponteiros e ordem.
- **RN-KNW-010:** Um vault suporta até 200 pastas e 2.000 notas. Acima do teto de pastas, o Vault Context é truncado com aviso explícito.

### 8.3 Regras de negócio: nota

- **RN-KNW-020:** O `slug` da nota é único **dentro do vault**, e não dentro da pasta, porque é assim que os links resolvem (§10.1).
- **RN-KNW-021:** Mover uma nota entre pastas do mesmo vault nunca gera conflito de slug.
- **RN-KNW-022:** Mover uma nota entre vaults exige política explícita para colisão de slug (`REJECT` ou `RENAME`).
- **RN-KNW-023:** Mover uma nota entre vaults preserva o `NoteId` e, com ele, a linha do tempo inteira da nota.
- **RN-KNW-024:** Mover uma nota para fora de um vault **quebra todos os backlinks que apontavam para ela naquele vault**. É consequência semântica correta (PP2), e os links que quebram passam a constar como quebrados no Discovery (§10.1).
- **RN-KNW-025:** Uma nota tem no máximo 1 MB de conteúdo.
- **RN-KNW-026:** Toda operação que altera estado registra autoria completa: o humano responsável e, quando houver, o agente que executou. Não existe alteração anônima.
- **RN-KNW-027:** Toda alteração de conteúdo gera uma revisão nova, imutável, referenciada pelo evento correspondente.
- **RN-KNW-028:** Se o conteúdo enviado for byte a byte idêntico ao atual, não há nova revisão, não há evento e não há reindexação.
- **RN-KNW-029:** Apagar uma nota é reversível: a nota sai das listagens e da busca, e o histórico permanece consultável pelo identificador da nota.
- **RN-KNW-030:** Apagar uma nota libera o seu `slug` no vault; restaurá-la exige que o slug esteja livre novamente.
- **RN-KNW-031:** O backend não valida a nota contra o Template da pasta (PP3), e não interpreta frontmatter nem qualquer convenção de conteúdo (PP4).
- **RN-KNW-033:** Apagar um vault é reversível e não destrói byte algum: o vault sai de toda listagem e passa a responder `404` em todos os contextos, enquanto pastas, notas e revisões permanecem intactas e o histórico segue consultável. A operação pertence ao papel de administração do vault, como renomear. Apagar libera o nome do vault na assinatura, pela mesma razão de RN-KNW-030, e por isso restaurá-lo exige que o nome esteja livre de novo.

---

## 9. Domínio: Agent Access (o contrato público)

**O MCP é o contrato público do produto.** A API interna (`architecture-guide.md` §12) existe para servir a UI. É o catálogo de tools abaixo que os clientes externos consomem, e é ele que a política de versionamento protege (`CLAUDE.md` § Política de versionamento).

### 9.1 Catálogo de tools

| Tool | Assinatura | Papel |
|---|---|---|
| `whoami` | `()` | Quem está agindo, o que a conexão alcança e **como escrever aqui**: a ordem de leitura do vault e o catálogo inteiro |
| `list_vaults` | `()` | Vaults visíveis, com descrição |
| `create_vault` | `(name, description)` | Cria um vault na assinatura; nome repetido devolve `ALREADY_EXISTS` com o identificador do existente (RN-KNW-032) |
| `delete_vault` | `(vault)` | Apaga um vault, de forma reversível e sem destruir byte algum (RN-KNW-033) |
| **`get_vault_context`** | `(vault)` | **A chamada principal.** Guidance integral mais árvore com descrições, ordem, contagem de notas e quais pastas têm template |
| `set_guidance` | `(vault, content)` | Escreve a Guidance do vault, que é o documento que declara como este vault quer ser escrito |
| `create_folder` | `(vault, name, description, parent?)` | Cria uma pasta; a descrição é obrigatória, porque é ela que diz o que pertence ali |
| `delete_folder` | `(vault, folder, policy)` | Remove uma pasta sob política explícita, `REJECT_IF_NOT_EMPTY` ou `CASCADE` (RN-KNW-007) |
| `get_template` | `(vault, folder)` | O Template da pasta, a ler antes de escrever |
| `set_template` | `(vault, folder, content)` | Escreve o Template da pasta |
| `list_notes` | `(vault, folder?)` | Índice de notas, na ordem definida |
| `read_note` | `(vault, note, asOf?)` | Markdown completo e a revisão corrente; com `asOf`, a revisão vigente naquela data |
| `create_note` | `(vault, folder, title, content)` | O caminho de ingestão (§1.3) |
| `update_note` | `(vault, note, content, baseRevision)` | Atualização com detecção de conflito |
| `delete_note` | `(vault, note)` | Apaga uma nota, de forma reversível (RN-KNW-029) |
| `search_notes` | `(vault, query)` | Busca literal no texto do vault, com campos e operadores (§10.2) |
| `related_notes` | `(vault, note, depth?)` | Árvore de dependências pelo grafo de links |
| `backlinks` | `(vault, note)` | Quem aponta para esta nota |
| `note_history` | `(vault, note)` | Linha do tempo: quem alterou, quando, com qual agente |

### 9.2 O Vault Context

A saída de `get_vault_context` é **o produto**, não um detalhe de apresentação: é o equivalente exato do que o agente obtém hoje lendo o documento de orientação e rodando `ls -R` na pasta local, em uma única chamada.

```markdown
# Vault: Normas e Legislação
<conteúdo integral do Guidance>

## Structure
1. **Normas**: Texto normativo por artigo. Uma norma por nota, sempre com órgão e vigência. (48 notes, has TEMPLATE.md)
2. **Achados**: Achados de auditoria. Todo achado cita a norma que o fundamenta. (23 notes, has TEMPLATE.md)
3. **Trabalhos/**: Relatórios emitidos. (5 notes)
   3.1. **2026**: Emitidos neste exercício. (5 notes, has TEMPLATE.md)
```

Os rótulos que o produto escreve (`## Structure`, `notes`, `has TEMPLATE.md`) são en-US, como toda a superfície MCP, que é contrato público e tem `en_US` como locale canônico (`CLAUDE.md` § Política de idioma). O que aparece em português no exemplo acima é o conteúdo do vault, escrito por quem o autora, e é assim que sai em qualquer idioma que o vault use.

Três decisões visíveis nesse formato:

- **A descrição de cada pasta vem junto.** É ela que direciona onde o agente escreve, e é por isso que é obrigatória (RN-KNW-006).
- **A ordem é a ordem definida**, numerada, porque é sinal e não enfeite (PP9).
- **A contagem de notas vem junto.** O agente sabe onde há massa antes de pedir qualquer listagem.

### 9.3 Escrita por agente

- **RN-AGT-001:** Toda escrita via MCP registra autoria completa: o humano dono da autorização e a identidade do agente que executou.
- **RN-AGT-002:** O servidor não valida o conteúdo contra o Template (PP3), mas a descrição da tool instrui a chamar `get_template` antes de escrever.
- **RN-AGT-003:** Erro de argumento faltante devolve, junto da mensagem, a informação necessária para a próxima tentativa, incluindo o Template da pasta quando pertinente (PP10).
- **RN-AGT-004:** `create_note` com um slug já existente no vault devolve `ALREADY_EXISTS` **com o identificador da nota existente**, e nunca cria uma segunda nota. O servidor jamais gera sufixo automático, porque é isso que transformaria um retry de transporte em duplicata silenciosa.
- **RN-AGT-005:** `update_note` exige `baseRevision`. Se a revisão corrente divergir, o servidor devolve `CONFLICT` **com o conteúdo atual anexado**, para o agente decidir entre refazer ou fundir. Sobrescrita cega não é aceita num vault que sustenta auditoria.
- **RN-AGT-006:** Um usuário com papel `VIEWER` recebe recusa em `create_note` e `update_note`.
- **RN-AGT-007:** O conector opera sempre na assinatura fixada no consentimento (RN-SUB-014); nenhuma tool recebe a assinatura como argumento.
- **RN-AGT-008:** Nenhum vocabulário de MCP entra no modelo de domínio: trocar de protocolo não muda regra de negócio.

### 9.4 Distribuição do conector

O conector é o produto na visão de quem chega por uma plataforma de IA, e a forma como ele é encontrado faz parte do contrato público tanto quanto a assinatura das tools. O mecanismo de diretório curado e seus critérios estão em `knowledge-base.md` §3.7; as regras abaixo dizem o que o MemorySmith faz a respeito.

- **RN-AGT-009:** Toda tool do catálogo declara um título legível e a marca de leitura ou de destruição. Nenhuma tool entra no catálogo sem as duas coisas. A regra vale desde a primeira tool, e não a partir de uma eventual submissão a diretório: são essas marcas que decidem se o cliente executa a chamada direto ou pede confirmação ao usuário, então a ausência cobra atrito de quem usa o produto, listado ou não.
- **RN-AGT-014:** O conector escreve o vault inteiro, e não apenas as notas dele. Criar e apagar vault, escrever a Guidance, criar e apagar pasta, escrever o Template e apagar nota existem como tools próprias, sob as mesmas regras de papel que a interface obedece: a decisão é sempre do vault, tomada pelo caso de uso, e nunca do protocolo. A razão é a tese do produto (§1.4): um agente que só pode acrescentar notas a uma estrutura que outra pessoa montou não escreve conhecimento, apenas o deposita.
- **RN-AGT-010:** Leitura e escrita nunca compartilham uma tool. Não existe tool genérica parametrizada por operação. O catálogo de §9.1 já nasce assim, e a regra existe para que continue assim quando a superfície crescer.
- **RN-AGT-011:** O registro de cliente OAuth do conector é feito por Client ID Metadata Document. O produto não oferece registro dinâmico de cliente, e os metadados de authorization server anunciam as duas chaves que a seleção de CIMD exige (`knowledge-base.md` §3.4). A decisão tem duas razões: registro dinâmico criaria um cliente OAuth novo a cada conexão, o que é justamente o padrão de tráfego esperado de um conector distribuído, e o provedor de identidade que usamos não implementa nenhum dos dois mecanismos, o que já nos obriga a intermediar o registro.
- **RN-AGT-013:** `whoami` responde duas perguntas na mesma chamada: **quem** a conexão representa (a pessoa que autorizou, o conector e a assinatura fixada no consentimento) e **como o produto espera ser usado** (a ordem de leitura Guidance, estrutura de pastas com a descrição de cada uma, e Template da pasta de destino). A parte de ajuda é **derivada do próprio catálogo**, nunca escrita ao lado dele: um texto paralelo divergiria na primeira tool renomeada, e uma ajuda que cita tool inexistente manda o agente por um caminho que falha. `whoami` também declara que o servidor **não valida** o conteúdo contra Guidance nem Template (PP4), porque um agente que supuser validação confia numa checagem que nunca acontece.
- **RN-AGT-012:** A listagem em diretório é objetivo de produto, não do recorte inicial. Ela pressupõe catálogo de tools implementado, política de privacidade publicada, documentação pública e uma conta de demonstração com vaults povoados. Enquanto não houver listagem, o conector é adicionado como conector personalizado, e a documentação do produto precisa dizer ao usuário quais respostas dar no formulário.

---

## 10. Domínio: Discovery

Três projeções sobre os mesmos fatos, respondendo perguntas diferentes. Comparação conceitual em `knowledge-base.md` §5.6.

### 10.1 Grafo de links

Cada link escrito no corpo de uma nota vira uma aresta. Duas formas são reconhecidas: `[[wikilink]]` e link Markdown relativo `[texto](caminho.md)`.

**Regra de resolução, uma só para as duas formas.** O alvo é reduzido ao nome do arquivo sem extensão, normalizado, e resolvido **no escopo do vault**.

- **RN-DSC-001:** Segmentos de caminho no link (`../normas/`) são deliberadamente ignorados na resolução. A aresta é entre notas, não entre pastas, e honrar o caminho faria o link quebrar quando a nota mudasse de pasta, que é exatamente o que o produto existe para evitar.
- **RN-DSC-002:** Âncora (`#seção`) é descartada na resolução e preservada na exibição.
- **RN-DSC-003:** Link com esquema ou host (`https://…`) é externo: não vira aresta.
- **RN-DSC-004:** Link cujo alvo ainda não existe não é descartado: vira **link pendente** e resolve sozinho quando uma nota com aquele slug for criada. Sem isso, o grafo mentiria justamente enquanto o vault está sendo escrito, que é quando ele é mais consultado.
- **RN-DSC-005:** Apagar uma nota remove suas arestas e devolve ao estado pendente os backlinks que apontavam para ela.
- **RN-DSC-006:** Não existe link entre vaults (PP2). Mover uma nota para outro vault poda suas arestas no vault de origem.
- **RN-DSC-007:** A travessia do grafo é limitada a profundidade 3 e 200 nós, com ciclos deduplicados. Sem teto, um vault denso devolve o vault inteiro e afoga o agente.

**Saídas:** árvore de dependências a partir de uma nota, backlinks, links quebrados e notas órfãs.

> **No domínio regulado, o grafo é o rastro de fundamentação.** Uma nota de achado cita, no corpo, a nota da norma que a sustenta, e `related_notes` responde *"em que base normativa este achado se apoia?"*. Quem torna isso confiável é o Template da pasta, que manda escrever a fundamentação como link em vez de citar em prosa. O backend não sabe o que é um fundamento: ele vê uma aresta, e é o vault que decide o que ela significa (PP4).

### 10.2 Busca

A busca do produto é **literal sobre o texto do vault**: o corpo de cada nota, o título, a pasta e os headings. Ela responde "onde está escrita esta palavra", e casa por trecho, ignorando acento e caixa, de modo que um termo escrito uma única vez dentro de uma nota é encontrado digitando parte dele.

A consulta aceita vários termos, que precisam casar todos, `"frase exata"`, `-exclusão`, `OR`, parênteses e os campos `title:`, `folder:`, `content:` e `section:`. **Qualquer outro prefixo é lido como atributo de frontmatter do vault**, e é o que torna `maturity:evergreen`, `reviewed:false` ou um `norma:federal` que o vault inventou filtros válidos sem que nada disso esteja escrito no código. O vocabulário pertence ao Guidance (PP4, RN-DSC-020), e a linguagem ubíqua do vault vira a linguagem de consulta.

O que a busca **não** faz é procurar por significado. Uma nota que trate do assunto com outras palavras não volta. Isso existiu como `semantic_search`, apoiada em um índice vetorial, e foi **retirada na 0.2.0**: pontuar similaridade dentro da função exigia ler todos os trechos do vault a cada consulta, e o item de um trecho custava dez vezes o tamanho da nota. Quem procura por assunto conta com o grafo de links (§10.1) e as facetas de curadoria (§10.3) até que a capacidade volte sobre um índice adequado.

- **RN-DSC-010:** A busca sempre devolve a nota de origem junto do resultado, o heading sob o qual o trecho caiu quando houver um, e o trecho recortado do texto como foi escrito. Quem consome decide com a fonte à vista.
- **RN-DSC-011:** *(removida na 0.2.0)* Cada trecho era enriquecido com o contexto de onde veio, ou seja vault, pasta, descrição da pasta e título da nota, antes de ser vetorizado.
- **RN-DSC-012:** Mover uma nota de pasta dispara a reprojeção dela, porque a pasta faz parte do retrato que o vault mostra da nota.
- **RN-DSC-013:** Apagar uma nota a remove das projeções imediatamente, inclusive no soft delete. O que sai da listagem sai da busca, porque conteúdo apagado que continua sendo devolvido é problema de privacidade, não de qualidade.
- **RN-DSC-014:** Restaurar uma nota a reprojeta.
- **RN-DSC-015:** *(removida na 0.2.0)* O índice vetorial era isolado por assinatura, não filtrado por metadado dentro de um índice compartilhado. A exigência continua valendo para qualquer índice derivado por RN-SUB-015, e é ela que governa o índice de conteúdo que vier a substituí-lo.
- **RN-DSC-016:** Grafo, busca e facetas são derivados (PP5): apagar e reconstruir do zero a partir das notas é operação suportada, e é o plano de recuperação de todos.
- **RN-DSC-025:** A busca casa **trecho literal**, e não palavra inteira nem raiz. `14.133` é encontrado por `14.133` e não por `14133`, porque o separador foi escrito pelo autor e inventar uma normalização de números tornaria o resultado impossível de explicar. Acento e caixa, esses sim, são ignorados dos dois lados.
- **RN-DSC-026:** Os campos `title`, `folder`, `content` e `section` são os únicos que o backend conhece por nome. Todo outro prefixo de consulta é resolvido como faceta do vault, e um prefixo que não corresponda a faceta nenhuma simplesmente não casa, nunca é erro.
- **RN-DSC-027:** A busca varre todas as notas do vault a cada consulta, o que é sustentado pelo teto de 2.000 notas por vault (RN-KNW-010). A varredura precisa percorrer o índice inteiro: uma busca que responde de uma parte do vault sem dizer que parou é pior que busca nenhuma.
- **RN-DSC-028:** O frontmatter não participa do texto pesquisável. Ele é matéria do projetor de facetas (RN-DSC-018), e mantê-lo no corpo faria toda nota casar com o próprio metadado.

### 10.3 Facetas de curadoria

O painel de curadoria (a Visão geral do produto) responde perguntas de gestão do conhecimento: quanto do conteúdo está maduro, quanto já passou por revisão humana, como as notas se distribuem por tipo, por tag e por data de criação. A resposta vem da terceira projeção, as **facetas**: atributos de frontmatter agregáveis, extraídos de cada nota no momento em que ela muda e mantidos como contagens por vault. O conjunto de atributos não é fixo: quem define o frontmatter das notas é o Guidance de cada vault, e a projeção o descobre pela forma dos valores.

- **RN-DSC-017:** O painel de curadoria é servido por uma projeção derivada, alimentada pelos eventos de nota. Nenhuma tela e nenhuma tool varre notas para contar; quem conta é o projetor, uma vez, no momento da mudança.
- **RN-DSC-018:** Quem lê o frontmatter é o projetor de facetas do Discovery, segundo leitor sancionado de conteúdo ao lado do extrator de links. O core Knowledge continua sem ler conteúdo (PP4), e nenhuma faceta participa de regra, validação ou autorização: faceta orienta curadoria, nunca comportamento.
- **RN-DSC-019:** `maturity` (`seed`, `growing`, `evergreen`) e `reviewed` (`true`, `false`) são as facetas padrão do produto, o único vocabulário de frontmatter que o produto declara: `maturity` registra o estágio de maturação do conteúdo e é reavaliada a cada escrita; `reviewed` marca se a revisão vigente passou por revisão humana, somente um humano a escreve como `true` e qualquer edição posterior de conteúdo a devolve a `false`. Para o projetor elas não são caso especial, são atributos agregáveis como quaisquer outros; o padrão existe para que as telas e as tools do produto possam nomeá-las.
- **RN-DSC-020:** Os demais atributos são convenção do vault e não são configurados em lugar nenhum: a projeção classifica cada valor pela **forma** e agrega os agregáveis, ou seja datas, booleanos, valores curtos enumeráveis e listas de valores curtos (como `tags`). Texto livre é descartado. O que `type: evidence` quer dizer pertence ao Guidance, nunca ao backend.
- **RN-DSC-021:** Nota sem uma faceta conta como valor ausente; nunca é rejeitada nem corrigida. A projeção descreve o vault como ele está, e apontar lacuna é papel do painel, não do gravador.
- **RN-DSC-022:** Nota apagada sai das contagens no soft delete e volta na restauração, espelhando a busca (RN-DSC-013, RN-DSC-014).
- **RN-DSC-023:** A projeção de facetas é derivada (PP5): eventualmente consistente, apagável e reconstruível do zero a partir das notas, como o grafo e o índice de busca (RN-DSC-016).
- **RN-DSC-024:** Atributo que se revela texto livre pelo uso deixa de ser agregado: quando a cardinalidade de valores distintos de um atributo ultrapassa o teto por vault, suas contagens são descartadas e ele para de gerar estatística. É esse mecanismo, e não uma lista de exclusão mantida à mão, que impede `title` ou `source` de virarem estatística.

---

## 11. Domínio: Audit

O vault sustenta trabalho em ambiente regulado. Isso muda o que "guardar uma nota" significa: além do conteúdo atual, o sistema responde **quem escreveu, com qual agente, quando, e o que a nota dizia na data em que o trabalho foi emitido** (fundamentação em `knowledge-base.md` §7).

### 11.1 Entidades

#### Valor: `Authorship`

```
user_id,                     -- sempre um humano: o dono da autorização
agent?: {                    -- ausente = escrita pela UI
  client_id,
  client_name
},
at
```

O humano é sempre identificado, porque mesmo quando quem grava é o agente a autorização pertence a quem conectou. É esse par que transforma *"escrito por Fulano"* em *"escrito por tal agente, em nome de Fulano, em 12/03"*: a diferença entre um registro e um registro defensável.

#### Entidade: `AuditEvent`

```
subject (SUBSCRIPTION | MEMBER | VAULT | FOLDER | NOTE),
subject_id,
occurred_at,
type,                        -- o evento de domínio que ocorreu
authorship,
content_ref?,                -- a revisão exata do conteúdo naquele instante
payload
```

### 11.2 Regras de negócio

- **RN-AUD-001:** A trilha de auditoria é somente-acréscimo. Não existe caminho, de aplicação, de operação ou de administração, que altere ou remova um evento já registrado.
- **RN-AUD-002:** Todo evento registra autoria completa (humano e, quando houver, agente).
- **RN-AUD-003:** Todo evento que altera conteúdo carrega a referência à revisão exata daquele instante, não apenas o fato de que houve alteração.
- **RN-AUD-004:** A linha do tempo de uma nota é indexada pelo identificador da nota e sobrevive a ela mudar de pasta e de vault.
- **RN-AUD-005:** `read_note(asOf)` devolve o conteúdo vigente na data informada, reconstruído a partir da trilha, o que permite refazer um trabalho lendo a base como ela estava na data de emissão.
- **RN-AUD-006:** Apagar uma nota nunca destrói o conteúdo armazenado; o histórico continua legível.
- **RN-AUD-007:** *(removida na 0.4.0)* Tratava do expurgo, a destruição deliberada de conteúdo, como ato administrativo restrito ao `OWNER`, com motivo obrigatório e evento próprio. A capacidade nunca foi construída, e o que o produto de fato garante continua declarado em RN-AUD-006. O número é preservado e nunca será reaproveitado.
- **RN-AUD-008:** *(removida na 0.4.0)* Tratava da retenção legal da assinatura, que travaria as revisões contra remoção pelo prazo configurado. Nenhum caminho jamais alcançou essa ativação, e o que protege as revisões é a trilha somente-acréscimo de RN-AUD-001. O número é preservado e nunca será reaproveitado.
- **RN-AUD-009:** *(removida na 0.4.0)* Declarava que retenção legal e expurgo eram incompatíveis por desenho. Removidas as duas capacidades, a regra ficou sem objeto. O número é preservado e nunca será reaproveitado.

---

## 12. Domínio: Portability

Zero lock-in é requisito, não cortesia: é o que torna o produto seguro de adotar num contexto em que a base precisa sobreviver ao fornecedor (`knowledge-base.md` §10).

**O export é onde os nomes de arquivo passam a existir.** Dentro do sistema há identificadores opacos e papéis (§8.1); é aqui que `guidance` vira `GUIDANCE.md`, `template` vira `TEMPLATE.md` e o slug da nota vira nome de arquivo. A árvore anotada sai ao lado da Orientação, como `STRUCTURE.md`: as duas são exatamente as duas metades do Vault Context (§9.2), a que um humano escreve e a que o produto deriva.

```
Normas e Legislação/
├── GUIDANCE.md             ← a Orientação do vault, como um humano a escreveu
├── STRUCTURE.md            ← a árvore anotada: ordem, descrição de cada pasta e onde há Template
├── 01 Normas/
│   ├── TEMPLATE.md
│   └── lei-14133-art-75.md
└── 02 Achados/
    └── TEMPLATE.md
```

- **RN-PRT-001:** O export contém apenas arquivos `.md`, sem componente proprietário e sem índice obrigatório para leitura.
- **RN-PRT-002:** A ordem de pastas e de notas é codificada como prefixo numérico no nome, que é a única forma de preservá-la num sistema de arquivos, já que ele não tem ordem própria.
- **RN-PRT-003:** *(revista)* A árvore anotada do vault é materializada como `STRUCTURE.md` na raiz, com a ordem, a descrição de cada pasta, a contagem de notas e quais pastas têm Template. A descrição é atributo da pasta e nunca um documento, então nenhum arquivo é escrito dentro da pasta para carregá-la. Uma pasta sem Template e sem nota, por consequência, não deixa diretório na árvore exportada e sobrevive apenas no `STRUCTURE.md`. *(Até a 0.2.0 a regra dizia que a descrição era materializada como `README.md` dentro de cada pasta.)*
- **RN-PRT-004:** Os links saem intactos no texto das notas.
- **RN-PRT-005:** *(revista)* Uma nota cujo slug seja exatamente `guidance`, `structure` ou `template` é exportada com sufixo, e todos os links para ela são reescritos junto. É a única concessão do export, e ela pertence à borda, não ao modelo. *(Até a 0.2.0 os nomes reservados eram `readme` e `template`.)*
- **RN-PRT-006:** Notas apagadas não entram no export.

---

## 13. Interface da aplicação

**A UI é a única superfície de leitura humana do produto.** Isso levanta a régua da tela de nota e da árvore: elas precisam ser confortáveis para **ler**, não só para navegar.

### 13.1 Telas

**Entrada**

| Tela | Conteúdo |
|---|---|
| Entrada | Autenticação pelo provedor de identidade, e a volta dele. Não há cadastro aberto: a conta nasce por ato da operação da plataforma (§4.4) |
| Entrada sem assinatura ativa | Não existe tela de espera dentro do produto. Uma sessão cuja assinatura está ausente, aguardando aprovação ou bloqueada não alcança nada, então ela é encerrada e a pessoa volta à tela de entrada com a mensagem do seu caso: conta sem assinatura, assinatura aguardando autorização ou assinatura inativa. A distinção é deliberada, porque "não há nada aqui" e "seu acesso está suspenso" são fatos diferentes |
| Solicitação de assinatura | Fora do produto nesta fase. A rota existe na API, e quem solicita e aprova é a operação da plataforma; a interface não oferece o formulário |

**Conhecimento**

| Tela | Conteúdo |
|---|---|
| Catálogo de vaults | Cards com nome, descrição, número de notas e última atualização, e sob eles o painel da assinatura: contagem de vaults e de notas, links pendentes, notas órfãs, uso da quota e a distribuição do conteúdo pelas facetas que os vaults declaram (§10.3) |
| Vault → Contexto do Vault | O vault como o agente o recebe em `get_vault_context` (§9.2): a Orientação e os Modelos como pontos de entrada e a árvore de pastas com a descrição de cada uma. Leitura da estrutura, sem reordenar nem mover |
| Vault → Guidance | Leitura da Orientação do vault |
| Pasta | Leitura: a descrição da pasta, o Modelo dela e as notas na ordem declarada (PP9) |
| Pasta → Template | Leitura do Modelo da pasta |
| Nota | Leitura: as propriedades do frontmatter e o corpo em Markdown, com os wikilinks navegáveis e os pendentes marcados como tais (RN-DSC-004) |
| Vault → Grafo | O grafo de links do vault inteiro, navegável, com a nota aberta a partir dele |
| Vault → Busca | Campo único sobre o texto do vault, aceitando campos e operadores |
| Vault → Export | Baixa o vault inteiro como árvore de arquivos `.md`, no formato de §12 |

**O que a interface não alcança.** O governo da assinatura, ou seja membros, papéis, convites, titularidade, tetos de vault e troca de assinatura ativa, e a área de plataforma de §4.6, existem na API e não têm tela. As leituras de auditoria e de saúde, ou seja histórico de nota, atividade do vault, links quebrados e notas órfãs em lista, também. Quem precisa delas hoje chama a API ou usa os scripts de operação, e o que falta está registrado nas issues do repositório, que é onde o futuro mora.

### 13.2 Regras de interface

- Uma assinatura fora de `trial` ou `active` encerra a sessão e leva o usuário de volta à tela de entrada com a mensagem do seu caso, e nunca a uma tela de conteúdo vazia. A mensagem diz qual dos três casos é, porque a diferença entre "não há nada aqui" e "seu acesso está suspenso" é a diferença entre um bug aparente e uma informação.
- A superfície de leitura da nota segue as métricas do tema padrão do Obsidian, porque quem lê o vault na web e no Obsidian não deveria precisar reaprender a página.
- Nenhuma tela interpreta convenção de conteúdo. O frontmatter é apresentado como propriedades e o corpo é renderizado como Markdown universal, o que mantém a interface do mesmo lado de PP4 que o backend.

---

## 14. Limites do produto

Declarados para virarem teste, e não folclore. A tese é "sem atrito" (§1.4), e sem número isso não é verificável.

| | Limite |
|---|---|
| Tamanho de nota | 1 MB |
| Pastas por vault | 200 |
| Notas por vault | 2.000 |
| Profundidade da árvore | 6 níveis |
| Profundidade da travessia de grafo | 3, com teto de 200 nós |
| Propagação de mudança de papel | até 5 minutos |
| Validade do convite | 7 dias |

Metas de desempenho estão em `architecture-guide.md` §15.

---

## 15. Onde vivem o recorte de versão, os riscos e as questões em aberto

Este documento descreve o que o produto **faz**, e não o que ele vai fazer. Recorte de
versão, ordem de entrega, risco ainda não endereçado e questão não decidida descrevem
futuro, e por isso saíram daqui:

| O que você procura | Onde está |
|---|---|
| Recorte de versão, ordem de entrega, versão alvo | O Project do repositório |
| Riscos de produto | Issues com a label `risco` |
| Questões de produto ainda não decididas | Issues com a label `questao` |
| Riscos técnicos | Issues com a label `risco-tecnico` |
| O que já foi entregue, e quando | `CHANGELOG.md` e os GitHub Releases |

A regra que motiva a separação, e o ciclo que leva uma necessidade da issue até este
documento, estão em `development-process.md`.
