# Base de Conhecimento: Bases de Conhecimento em Markdown e o Ecossistema de Agentes

Este documento reúne **fatos do domínio** em que o MemoryVault.guru opera, coisas que continuariam verdadeiras se o produto não existisse: formatos, práticas estabelecidas, protocolos abertos, técnicas de recuperação e obrigações regulatórias.

Não contém entidades do produto, regras de negócio (`RN-XXX`) nem decisões de arquitetura. Para o produto, ver [`software-vision.md`](software-vision.md); para a engenharia, ver [`architecture-guide.md`](architecture-guide.md).

---

## Índice

1. [Markdown como formato de conhecimento](#1-markdown-como-formato-de-conhecimento)
2. [Prática de gestão de conhecimento em arquivos](#2-prática-de-gestão-de-conhecimento-em-arquivos)
3. [Model Context Protocol (MCP)](#3-model-context-protocol-mcp)
4. [Engenharia de contexto](#4-engenharia-de-contexto)
5. [Recuperação: lexical, vetorial e grafo](#5-recuperação-lexical-vetorial-e-grafo)
6. [Colaboração e concorrência em bases de texto](#6-colaboração-e-concorrência-em-bases-de-texto)
7. [Auditoria, proveniência e domínio regulado](#7-auditoria-proveniência-e-domínio-regulado)
8. [LGPD](#8-lgpd)
9. [SaaS multi-tenant: conceitos gerais](#9-saas-multi-tenant-conceitos-gerais)
10. [Portabilidade e lock-in](#10-portabilidade-e-lock-in)
11. [Glossário](#11-glossário)
12. [Referências](#12-referências)

---

## 1. Markdown como formato de conhecimento

### 1.1 O que é padronizado e o que é convenção

Markdown foi criado por John Gruber em 2004 como sintaxe de escrita legível em texto puro. A especificação original é informal e ambígua em vários pontos, o que gerou implementações divergentes. Duas iniciativas reduziram o problema:

| Camada | O que define | Status |
|---|---|---|
| **CommonMark** | Especificação estrita: parágrafos, ênfase, listas, headings ATX e setext, blocos de código, links inline e de referência, imagens, HTML embutido | Especificação formal com suíte de testes |
| **GitHub Flavored Markdown (GFM)** | CommonMark mais tabelas, listas de tarefas, autolinks e texto riscado | Superconjunto documentado do CommonMark |

Tudo o mais é **convenção de ferramenta**, não parte do formato. Isso importa para qualquer sistema que processe Markdown de terceiros: só o núcleo padronizado é seguro de interpretar, e o resto pode significar coisas diferentes em cada editor.

### 1.2 Frontmatter

Frontmatter é um bloco de metadados no topo do arquivo, delimitado por `---`, quase sempre em YAML:

```markdown
---
title: Lei 14.133, Art. 75
vigencia: 2021-04-01
tags: [licitacao, dispensa]
---

# Contratação direta por dispensa
```

**Frontmatter não faz parte do CommonMark nem do GFM.** É uma convenção que nasceu no Jekyll (2008) e se espalhou por geradores de site estático e ferramentas de notas. Consequências práticas:

- Nomes de campo não são padronizados. `tags`, `keywords`, `categories` coexistem, e cada ferramenta lê os seus.
- Um parser CommonMark puro trata o bloco como conteúdo (a primeira linha `---` vira uma linha horizontal ou um heading setext, dependendo do que vem depois).
- Qualquer sistema que **exija** um esquema de frontmatter está impondo convenção própria ao conteúdo do usuário.

### 1.3 Links: wikilink e link relativo

Duas formas convivem em bases de conhecimento em arquivos:

| Forma | Sintaxe | Origem | Padronizado? |
|---|---|---|---|
| **Link Markdown relativo** | `[texto](../pasta/nota.md)` | CommonMark | Sim |
| **Wikilink** | `[[nota]]` ou `[[nota\|texto]]` | Wikis (WikiWikiWeb, 1995); repopularizado por Roam Research e Obsidian | Não |

O wikilink resolve por **nome**, não por caminho: quem escreve não precisa saber onde o alvo mora. É por isso que ele domina em bases pessoais, onde as notas se movem de pasta com frequência. O link relativo, ao contrário, quebra sempre que uma das duas notas muda de lugar, o que faz dele uma escolha ruim para conteúdo que será reorganizado.

Detalhes que qualquer resolvedor precisa decidir:

- **Extensão.** `[[nota]]` e `[[nota.md]]` normalmente designam o mesmo alvo.
- **Âncora.** `[[nota#seção]]` aponta para um heading dentro da nota.
- **Alias.** `[[nota|como aparece no texto]]` separa alvo de rótulo.
- **Escopo.** O nome é único dentro de quê? Da pasta, da base inteira, do sistema?
- **Alvo inexistente.** Em Obsidian e similares, um link para uma nota que ainda não existe é válido e vira o gesto de criação. Descartá-lo empobrece o grafo justamente enquanto a base está sendo escrita.

### 1.4 Por que Markdown venceu para bases de conhecimento

- **Legível sem ferramenta.** O arquivo bruto é o conteúdo, sem camada de decodificação.
- **Versionável.** Diff por linha funciona, o que torna git um histórico útil.
- **Portável.** Um `.md` sobrevive ao desaparecimento do editor que o criou.
- **Nativamente digerível por LLM.** Modelos de linguagem foram treinados em volume enorme de Markdown, e headings e listas são estrutura que o modelo já lê como estrutura, sem instrução adicional.

O último ponto é o que muda o cálculo nos últimos anos: um formato escolhido por humanos por conveniência acabou sendo o formato mais barato de entregar a uma máquina.

---

## 2. Prática de gestão de conhecimento em arquivos

### 2.1 O arranjo canônico

O padrão de fato em gestão de conhecimento pessoal (PKM) é uma **pasta de arquivos `.md`**, versionada ou sincronizada, aberta por um editor que entende links entre notas. Obsidian chama essa pasta de *vault*; Logseq, Foam, Dendron, Zettlr e outros usam o mesmo arranjo com nomes diferentes.

O que essas ferramentas acrescentam ao sistema de arquivos:

- **Backlinks:** a lista de notas que apontam para a nota aberta. É a metade que o sistema de arquivos não dá.
- **Visão de grafo:** a base desenhada como rede de nós e arestas.
- **Templates:** moldes aplicados na criação de uma nota nova.
- **Busca:** lexical, sobre o texto de todos os arquivos.

### 2.2 Escolas de organização

| Escola | Ideia central | Consequência estrutural |
|---|---|---|
| **Zettelkasten** (Niklas Luhmann) | Notas atômicas, uma ideia por nota, conectadas por links; a estrutura emerge das conexões | Hierarquia de pastas é secundária; o grafo é o mapa |
| **PARA** (Tiago Forte) | Quatro categorias de topo: Projects, Areas, Resources, Archives | Hierarquia forte, orientada a ação |
| **Digital garden** | Notas publicadas em estado permanentemente inacabado, revisadas continuamente | Valoriza links e revisão sobre completude |
| **MOC** (Map of Content) | Notas-índice curadas que apontam para conjuntos de notas | Navegação por hubs em vez de pastas |

Nenhuma é "a certa". O que elas têm em comum e que importa aqui: **a organização é decidida por quem escreve, e precisa ser declarada em algum lugar para que outra pessoa, ou outro agente, consiga contribuir sem quebrá-la.**

### 2.3 Guidance e template como prática

Duas convenções recorrentes e independentes de ferramenta:

- **Um documento de orientação na raiz** (`README.md`, `000 Index.md`, `Home.md`) que explica para que a base serve e como escrever nela.
- **Um molde por categoria de nota** (`TEMPLATE.md`, pasta `_templates/`) descrevendo as seções esperadas.

Quando a base é lida por um humano, esses documentos são cortesia. **Quando é escrita por um agente, eles deixam de ser documentação e viram instrução executável**: são o que decide se a nota nasce na pasta certa e com a estrutura certa. A qualidade do que entra na base passa a ser função direta da qualidade desses dois textos, e o efeito só aparece depois, no consumo.

### 2.4 Higiene de uma base

Três sinais medem a saúde de uma base ligada por links:

| Sinal | O que é | O que indica |
|---|---|---|
| **Link quebrado** | Aponta para um alvo que não existe | Nota removida, renomeada, ou nunca escrita |
| **Nota órfã** | Nenhuma nota aponta para ela | Conteúdo inalcançável por navegação; frequentemente esquecido |
| **Link pendente** | Aponta para algo que ainda não existe, mas deveria | Trabalho declarado e não feito. Em Zettelkasten, é considerado sinal positivo |

A distinção entre "quebrado" e "pendente" é de intenção, não de mecanismo: os dois são a mesma aresta não resolvida.

### 2.5 Onde o arranjo local trava

O arranjo pasta com editor funciona muito bem para uma pessoa e falha em três pontos previsíveis:

1. **Colaboração.** Sincronizar arquivos não resolve edição concorrente. Dropbox e similares produzem arquivos em conflito; git exige que todos os envolvidos operem git.
2. **Leitura remota.** Editores de vault são clientes locais. Ler a base de outro dispositivo, ou de dentro de outra ferramenta, é fora do desenho.
3. **Múltiplas bases.** Separar assuntos exige múltiplas pastas soltas, sem um lugar que as liste, descreva e controle acesso.

---

## 3. Model Context Protocol (MCP)

### 3.1 O problema que resolve

Antes do MCP, cada aplicação de LLM integrava cada fonte de dados com código próprio: *M* aplicações × *N* fontes resultavam em *M×N* integrações. O MCP é um protocolo aberto, publicado pela Anthropic no fim de 2024, que padroniza essa borda: a fonte implementa o protocolo uma vez (*servidor*) e qualquer aplicação que o fale (*cliente*) a consome.

O transporte de mensagens é **JSON-RPC 2.0**, com uma fase de inicialização em que cliente e servidor negociam versão do protocolo e capacidades.

### 3.2 Primitivas

O servidor pode oferecer três primitivas:

| Primitiva | O que é | Quem decide usar |
|---|---|---|
| **Tool** | Uma operação executável, com esquema de entrada declarado | O modelo, durante o raciocínio |
| **Resource** | Um dado endereçável por URI, lido como contexto | A aplicação cliente |
| **Prompt** | Um modelo de interação parametrizado, oferecido ao usuário | O usuário |

O cliente, por sua vez, pode oferecer capacidades ao servidor: *sampling* (pedir uma completação ao modelo), *roots* (informar quais diretórios ou URIs estão no escopo) e *elicitation* (pedir informação adicional ao usuário).

Na prática, **tools são a primitiva com suporte mais uniforme entre clientes**. Um servidor que precisa funcionar em todo lugar expõe suas capacidades como tools.

### 3.3 Transportes

| Transporte | Uso |
|---|---|
| **stdio** | Servidor roda como processo local, com comunicação por entrada e saída padrão. Simples, sem rede e sem autenticação, já que o processo roda como o próprio usuário. |
| **Streamable HTTP** | Servidor remoto acessível por HTTP, com respostas que podem ser streamadas. Substituiu o transporte HTTP+SSE das primeiras revisões do protocolo. |

Servidor remoto é o que permite que uma base hospedada seja consumida por clientes que o usuário não controla, e é o que traz o problema de autorização junto.

### 3.4 Autorização de servidores MCP remotos

A especificação de autorização do MCP se apoia inteiramente em padrões existentes de OAuth 2.1, em vez de inventar esquema próprio. As peças:

| Padrão | RFC | Papel |
|---|---|---|
| **OAuth 2.1** | draft (consolidação de OAuth 2.0 e BCPs) | Base: PKCE obrigatório, sem grant implícito, sem password grant |
| **Protected Resource Metadata** | RFC 9728 | O servidor MCP declara, num documento bem-conhecido, **qual** authorization server o protege |
| **Authorization Server Metadata** | RFC 8414 | O authorization server declara seus endpoints |
| **Dynamic Client Registration** | RFC 7591 | O cliente se registra sozinho no authorization server, sem intervenção humana |
| **PKCE** | RFC 7636 | Protege o fluxo de código de autorização contra interceptação |
| **Resource Indicators** | RFC 8707 | O token é emitido para um recurso específico, e não serve para outro |

O papel dos atores: o **servidor MCP é Resource Server**, e a identidade fica com um **Authorization Server** separado.

**O ponto de atrito prático é o Dynamic Client Registration.** Sem DCR, o cliente não consegue se registrar sozinho e o usuário precisa colar `client_id` e `client_secret` à mão na configuração do conector. Isso funciona, porque os clientes aceitam credenciais informadas manualmente, mas transfere trabalho de configuração para quem só queria conectar. Nem todo provedor de identidade implementa DCR: alguns provedores gerenciados, por exemplo WorkOS AuthKit e Auth0, oferecem; o Amazon Cognito, no momento em que este documento foi escrito, não.

### 3.5 Clientes

Um mesmo servidor MCP remoto pode ser consumido por clientes bem diferentes: aplicações web e desktop, ferramentas de linha de comando, ambientes de trabalho agentivo e IDEs. Isso muda duas coisas para quem escreve o servidor:

- **A descrição da tool é interface de usuário.** É o texto que o modelo lê para decidir se e como chamar. Uma descrição vaga produz chamada errada com a mesma facilidade com que um botão mal rotulado produz clique errado.
- **A sessão pode ser longa e não interativa.** Um trabalho de ingestão automatizado roda por muito tempo sem ninguém olhando. Qualquer estado ambíguo que possa mudar no meio do caminho, como qual organização está ativa, precisa ser fixado no início, e não resolvido por omissão a cada chamada.

### 3.6 Boas práticas de desenho de tools

- **Poucas tools, bem nomeadas.** Uma superfície grande dilui a atenção do modelo e aumenta a chance de escolha errada.
- **Uma chamada que resolva o caso comum.** Se entender o estado do sistema exige cinco chamadas encadeadas, o custo em tokens e latência mata o uso.
- **Erro acionável.** A mensagem de erro é lida pelo modelo e vira a próxima ação. "Argumento inválido" desperdiça o turno; "faltou `folder`; as pastas disponíveis são A, B, C" o resolve.
- **Idempotência explícita.** Retry de transporte é rotina. Se a segunda chamada idêntica cria uma segunda coisa, a base se enche de duplicatas silenciosas.
- **Concorrência declarada.** Escrita cega sobrescreve trabalho alheio. O padrão estabelecido é exigir a versão-base na atualização e recusar quando ela divergiu.

---

## 4. Engenharia de contexto

### 4.1 A janela é um recurso escasso

Um LLM raciocina sobre o que está na janela de contexto. Isso cria três pressões simultâneas:

- **Custo:** tokens de entrada são pagos a cada chamada.
- **Latência:** contexto maior demora mais para processar.
- **Qualidade:** a atenção não é uniforme ao longo da janela. Informação enterrada no meio de um contexto muito grande é atendida com menos confiabilidade do que a mesma informação num contexto enxuto, efeito documentado na literatura como *lost in the middle*.

A conclusão prática é contraintuitiva: **entregar tudo não é entregar melhor**. Um índice anotado de 40 linhas pode produzir resultado melhor que o despejo de 400 notas.

### 4.2 Instrução executável versus documentação

Quando um agente escreve numa base, o texto que descreve a base deixa de ser descritivo e passa a ser prescritivo. Três níveis, do mais geral ao mais específico:

| Nível | Responde | Se estiver fraco |
|---|---|---|
| Orientação da base | "para que serve isto e como se escreve aqui?" | A nota nasce com tom, granularidade e vocabulário errados |
| Descrição de cada categoria ou pasta | "o que se guarda aqui?" | A nota nasce no lugar errado |
| Molde da nota | "como esta nota se estrutura?" | A nota nasce sem as seções que o consumo depois vai procurar |

O efeito de um texto fraco em qualquer um dos três níveis é **diferido**: não aparece na ingestão, aparece meses depois, quando alguém tenta usar a base e descobre que ela é inconsistente.

### 4.3 Estrutura declarada versus estrutura inferida

Um agente diante de uma pasta de arquivos infere a organização a partir dos nomes. Um agente diante de uma estrutura **declarada**, com cada categoria descrevendo o que guarda e com uma ordem deliberada, não precisa inferir nada.

A diferença é maior na escrita que na leitura. Para ler, inferir errado custa uma busca a mais. Para escrever, inferir errado custa uma nota no lugar errado, que só será descoberta depois, se for.

---

## 5. Recuperação: lexical, vetorial e grafo

### 5.1 Busca lexical

Casamento de termos: `LIKE`, índice invertido, BM25. Barata, exata, explicável. Falha quando quem busca não conhece o vocabulário de quem escreveu, já que "prazo de guarda" não encontra uma nota que diz "período de retenção".

### 5.2 Embeddings e busca vetorial

Um modelo de embedding transforma texto num vetor denso de dimensão fixa, posicionado num espaço onde proximidade corresponde a proximidade de significado. Buscar é embeddar a pergunta e devolver os vetores mais próximos, tipicamente por similaridade de cosseno.

Propriedades que decidem o desenho de qualquer sistema que use isso:

- **O que se busca é o trecho, não o documento.** Vetorizar um documento longo inteiro dilui o significado a ponto de tornar o vetor inútil.
- **O vetor é derivado.** Pode ser reconstruído a partir do texto a qualquer momento, e nunca é fonte da verdade.
- **Trocar o modelo de embedding invalida o índice.** Vetores de modelos diferentes não são comparáveis entre si.
- **Custo é por escrita.** Cada alteração de conteúdo obriga a re-embeddar o que mudou.

### 5.3 Chunking

Recortar o documento em trechos é a decisão que mais afeta a qualidade da recuperação. Estratégias comuns: por tamanho fixo com sobreposição, por parágrafo, por seção (heading), ou semântica, quebrando onde o assunto muda.

**O problema central do chunking é a perda de contexto.** Um trecho que diz "o limite é 200 por conta" é irrecuperável isolado: não se sabe limite de quê, de qual sistema, sob qual regra. A mitigação estabelecida é **enriquecer o trecho com o contexto de onde ele veio**, ou seja título do documento, hierarquia de seções e descrição da categoria, antes de gerar o embedding. É a diferença entre um índice que funciona e um que devolve resultado plausível e inútil.

### 5.4 RAG e seus modos de falha

*Retrieval-Augmented Generation* é o padrão de recuperar trechos relevantes e injetá-los no contexto antes de gerar a resposta. Os modos de falha são conhecidos e nenhum é resolvido por um modelo melhor:

| Falha | Descrição |
|---|---|
| **Recuperação silenciosamente vazia** | Nada relevante foi encontrado, e o modelo responde mesmo assim, do conhecimento paramétrico |
| **Plausível-porém-errado** | O trecho recuperado parece pertinente e não é; sem a fonte à vista, ninguém percebe |
| **Trecho sem contexto** | Recuperado corretamente, mas ininteligível fora do documento de origem |
| **Índice desatualizado** | O conteúdo mudou e os vetores não; a busca devolve o passado |
| **Conteúdo apagado ainda indexado** | O documento saiu da base e continua sendo devolvido. É problema de privacidade, não de qualidade |

A mitigação transversal é **sempre citar a origem**: quem consome decide com a fonte à vista, em vez de confiar no resumo.

### 5.5 Grafo de links como recuperação

Se as notas se citam, os links formam um grafo dirigido, com arestas de saída ("o que esta nota referencia") e de entrada ("quem depende desta"). Perguntas que o grafo responde e a busca vetorial não:

- Em que base esta afirmação se apoia?
- O que quebra se esta nota mudar?
- O que ninguém cita?

Duas restrições práticas em travessia de grafo: **profundidade máxima** e **teto de nós**. Numa base densa, uma travessia sem limite devolve a base inteira, o que é o mesmo que não recuperar nada, com custo maior.

### 5.6 Complementaridade

| | Grafo de links | Busca vetorial |
|---|---|---|
| Fonte | Links escritos por quem redigiu | Significado inferido do texto |
| Precisão | Exata, porque houve intenção declarada | Aproximada |
| Custo | Praticamente zero | Embedding por escrita e por consulta |
| Falha típica | Link quebrado | Resultado plausível e irrelevante |
| Serve melhor | Quem já organizou a base | Quem está chegando nela |

Não são alternativas: respondem perguntas diferentes.

---

## 6. Colaboração e concorrência em bases de texto

### 6.1 Escrita concorrente

Três abordagens, com trocas diferentes:

| Abordagem | Como funciona | Custo |
|---|---|---|
| **Last-write-wins** | A última escrita sobrescreve | Perda silenciosa de trabalho |
| **Concorrência otimista** | Quem escreve informa a versão que leu; divergência é recusada | Um campo a mais e um caminho de conflito a tratar |
| **CRDT / OT** | Edições convergem automaticamente (edição colaborativa em tempo real) | Complexidade alta; muda o modelo de dados inteiro |

Para conteúdo que sustenta decisão, como parecer, laudo ou relatório, sobrescrita silenciosa não é aceitável: o registro passa a mostrar uma versão que ninguém aprovou. Concorrência otimista é o equilíbrio usual.

O agente agrava o problema: ele escreve rápido, em lote, e não percebe que sobrescreveu.

### 6.2 Papéis

O mínimo estabelecido em ferramentas colaborativas de conhecimento: **quem administra**, **quem escreve**, **quem só lê**. Papel de leitura não é detalhe, porque em base que sustenta auditoria o revisor externo precisa de acesso sem risco de alterar o que revisa.

---

## 7. Auditoria, proveniência e domínio regulado

### 7.1 O que a auditoria exige de um registro

Trabalho de auditoria, seja interna, externa ou regulatória, precisa que cada conclusão seja **rastreável até a evidência que a sustenta**, e que essa evidência seja demonstrável no futuro. Isso impõe quatro exigências a qualquer sistema que guarde a base de conhecimento usada no trabalho:

| Exigência | Pergunta que responde |
|---|---|
| **Autoria** | Quem produziu isto? |
| **Temporalidade** | Quando? |
| **Integridade** | Foi alterado depois? |
| **Reconstrução** | O que este documento dizia na data em que o trabalho foi emitido? |

A quarta é a mais cara e a mais esquecida. Sem ela, uma norma atualizada depois contamina retroativamente uma conclusão que estava correta quando foi emitida, e não há como demonstrar que estava.

### 7.2 Trilha append-only e WORM

Uma trilha de auditoria é um registro **somente-acréscimo**: eventos entram, e nada é alterado ou removido. A distinção que importa diante de um regulador:

- *"Nós não alteramos o log"* é política, e depende de disciplina.
- *"Nós não conseguimos alterar o log"* é propriedade técnica, e é verificável.

Só a segunda sustenta. Mecanismos usuais: permissão de escrita sem permissão de alteração no nível da infraestrutura, armazenamento WORM (*write once, read many*), retenção com trava temporal e encadeamento por hash.

### 7.3 Proveniência quando há agente no meio

Quando um agente de IA escreve, "autor" deixa de ser um campo só. Um registro defensável separa dois papéis:

- **Quem autorizou:** o humano dono da credencial usada. Sempre existe, porque alguém autorizou o conector.
- **O que executou:** a identidade do agente ou cliente, que no OAuth é o `client_id`.

A diferença entre *"escrito por Fulano"* e *"escrito por tal agente, em nome de Fulano, em tal data"* é a diferença entre um registro e um registro que se defende. Registrar só o humano esconde o processo, e registrar só o agente perde a responsabilidade.

### 7.4 Reconstrução histórica

Reconstruir o estado de um documento numa data passada exige duas coisas guardadas juntas:

1. Um evento com carimbo de tempo dizendo que algo mudou.
2. **A referência exata à versão do conteúdo naquele instante**, não ao documento, mas à versão.

Guardar só o primeiro produz o erro clássico: o log informa que o documento mudou e não consegue mostrar para quê, ficando inútil exatamente na pergunta que a auditoria faz.

### 7.5 Retenção legal versus apagamento

Retenção compulsória e direito ao apagamento conflitam por natureza, e o conflito é resolvido por hierarquia jurídica, não por configuração: **obrigação legal de retenção prevalece sobre pedido de eliminação**. Um sistema que ofereça as duas coisas precisa dizer isso na tela em que a retenção é ativada, e não no incidente.

Um segundo ponto, técnico: **apagar um registro e destruir os bytes são operações diferentes**. Confundi-las quebra a reconstrução histórica em silêncio, porque o log continua íntegro apontando para um conteúdo que já não existe. A prática estabelecida é tratar destruição de bytes como **ato administrativo registrado**, com motivo e autorização, e nunca como efeito colateral de uma operação de rotina.

---

## 8. LGPD

### 8.1 Enquadramento

A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) regula o tratamento de dados pessoais no Brasil. Papéis relevantes:

| Papel | Definição |
|---|---|
| **Titular** | A pessoa natural a quem os dados se referem |
| **Controlador** | Quem decide sobre o tratamento |
| **Operador** | Quem trata os dados em nome do controlador |
| **Encarregado (DPO)** | Canal entre controlador, titulares e a ANPD |

Um serviço que hospeda conteúdo de clientes é tipicamente **operador** em relação ao conteúdo que os clientes colocam nele, e **controlador** dos dados de cadastro dos próprios usuários. A distinção decide quem responde pelo quê.

### 8.2 Direitos do titular

O art. 18 assegura, entre outros: confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, **portabilidade**, e informação sobre compartilhamento.

O art. 16 trata da eliminação após o término do tratamento, ressalvando expressamente a conservação para **cumprimento de obrigação legal ou regulatória**, que é a base da hierarquia descrita em §7.5.

### 8.3 Dado pessoal em texto livre

Uma base de conhecimento em Markdown é texto livre: **não há como saber a priori se contém dado pessoal**. Consequências práticas para quem hospeda:

- Assumir que pode conter, e proteger de acordo.
- Isolamento entre clientes é requisito de proteção de dados, não só de arquitetura.
- Índices derivados (busca, vetores, cache) contêm cópias do conteúdo e precisam do mesmo tratamento, inclusive na exclusão. Conteúdo removido que continua retornando na busca é incidente.
- Registro de acesso e alteração é o que permite responder a um pedido de informação sobre tratamento.

### 8.4 Portabilidade

O direito de portabilidade tem tradução técnica direta: **exportar num formato aberto e legível**, e não num despejo proprietário. Para uma base em Markdown, isso significa devolver os `.md` numa árvore de arquivos que abre em qualquer editor.

---

## 9. SaaS multi-tenant: conceitos gerais

### 9.1 Modelos de isolamento

| Modelo | Descrição | Troca |
|---|---|---|
| **Silo** | Infraestrutura dedicada por cliente | Isolamento máximo, custo e operação máximos |
| **Pool** | Infraestrutura compartilhada, separação lógica por identificador | Custo mínimo, isolamento depende do código |
| **Bridge** | Compartilhado com partes isoladas (por exemplo dados juntos, chaves separadas) | Meio-termo |

A maioria dos SaaS opera em pool. O que decide se o pool é seguro não é o modelo, é **onde o identificador do cliente entra**.

### 9.2 Onde vaza

O vazamento entre clientes quase nunca acontece por invasão: acontece por consulta esquecida. Padrões conhecidos:

- **IDOR** (*Insecure Direct Object Reference*): o identificador do recurso vem da requisição e é usado sem verificar a quem pertence. Trocar o ID na URL devolve o dado de outro cliente.
- **Filtro esquecido:** uma consulta nova, escrita meses depois, não repete o filtro por cliente.
- **Índice derivado sem fronteira:** a busca ou o cache não carregam a separação que o banco carrega.
- **Erro que confirma existência:** `403` diz "existe e você não pode ver", e `404` não diz nada. Em sistema multi-cliente, a diferença é vazamento de informação.

A mitigação estrutural é conhecida: **o identificador do cliente vem da credencial autenticada, nunca da requisição**, e faz parte da chave de acesso ao dado, não de um filtro aplicado depois.

### 9.3 Identidade global versus vínculo

Uma pessoa pode participar de mais de uma organização com a mesma conta, caso comum quando existe convite entre organizações. Isso separa dois conceitos que sistemas ingênuos misturam:

- **Identidade** é global e não pertence a nenhuma organização.
- **Participação** é uma relação `(pessoa, organização)`, com papel próprio em cada uma.

Quando existe mais de uma participação, a sessão precisa de um **contexto ativo** explícito, escolhido e não descoberto. Deixar que o sistema deduza a organização ativa é decidir a fronteira de isolamento por acidente. Em sessões longas e não interativas, o contexto ativo precisa ser fixado no início e não mudar no meio do trabalho.

---

## 10. Portabilidade e lock-in

Uma base de conhecimento é ativo de longo prazo: é adotada esperando que dure mais que o fornecedor que a hospeda. Isso torna portabilidade um **requisito de adoção**, não uma cortesia, especialmente em contexto regulado, onde a base precisa continuar disponível para responder por trabalho emitido anos antes.

O que caracteriza um export honesto:

- Formato aberto, legível sem a ferramenta que o gerou.
- Estrutura preservada de forma que sobreviva ao sistema de arquivos, que não tem ordem própria e por isso exige que a ordem seja codificada no nome quando ela importa.
- Links preservados no texto.
- Sem componente proprietário obrigatório para leitura.

Um sistema de arquivos não tem alguns conceitos que uma base tem: ordem entre irmãos, descrição de pasta, papéis especiais de documento. Materializá-los na exportação é sempre uma **concessão de borda**, com convenções de nome que existem no arquivo exportado e não no modelo original.

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **Backlink** | Lista das notas que apontam para a nota atual |
| **Chunk** | Trecho de documento recortado para vetorização |
| **CommonMark** | Especificação formal e estrita de Markdown |
| **CRDT** | Estrutura de dados que converge sob edição concorrente sem coordenação |
| **DCR** | *Dynamic Client Registration* (RFC 7591): registro automático de cliente OAuth |
| **Embedding** | Representação vetorial densa de um texto |
| **Frontmatter** | Bloco de metadados no topo do arquivo, delimitado por `---`; convenção, não padrão |
| **GFM** | *GitHub Flavored Markdown*, superconjunto do CommonMark |
| **IDOR** | Referência direta insegura a objeto; falha clássica de isolamento |
| **JSON-RPC 2.0** | Protocolo de chamada remota usado pelo MCP |
| **Lost in the middle** | Degradação de atenção sobre informação no meio de contextos longos |
| **MCP** | *Model Context Protocol*, protocolo aberto entre aplicações de LLM e fontes de dados |
| **MOC** | *Map of Content*, nota-índice curada |
| **Nota órfã** | Nota sem nenhuma aresta de entrada |
| **PARA** | Método de organização: Projects, Areas, Resources, Archives |
| **PKCE** | *Proof Key for Code Exchange* (RFC 7636) |
| **PKM** | *Personal Knowledge Management* |
| **PRM** | *Protected Resource Metadata* (RFC 9728) |
| **RAG** | *Retrieval-Augmented Generation* |
| **Streamable HTTP** | Transporte HTTP do MCP para servidores remotos |
| **Vault** | Pasta de notas tratada como base de conhecimento por editores como o Obsidian |
| **Wikilink** | Link por nome no formato `[[alvo]]`; convenção, não padrão |
| **WORM** | *Write Once, Read Many*, armazenamento não regravável |
| **Zettelkasten** | Método de notas atômicas interligadas |

---

## 12. Referências

**Formato**
- CommonMark Specification: <https://spec.commonmark.org/>
- GitHub Flavored Markdown Spec: <https://github.github.com/gfm/>

**Protocolo**
- Model Context Protocol, especificação e documentação: <https://modelcontextprotocol.io/>
- RFC 9728: OAuth 2.0 Protected Resource Metadata
- RFC 8414: OAuth 2.0 Authorization Server Metadata
- RFC 7591: OAuth 2.0 Dynamic Client Registration Protocol
- RFC 7636: Proof Key for Code Exchange (PKCE)
- RFC 8707: Resource Indicators for OAuth 2.0

**Recuperação**
- Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* (2020)
- Liu et al., *Lost in the Middle: How Language Models Use Long Contexts* (2023)

**Regulatório**
- Lei nº 13.709/2018 (LGPD), em especial arts. 16, 18 e 46
- ANPD, Autoridade Nacional de Proteção de Dados: <https://www.gov.br/anpd/>

**Prática de conhecimento**
- Ahrens, S. *How to Take Smart Notes* (Zettelkasten)
- Forte, T. *Building a Second Brain* (PARA)
- Obsidian, documentação de vaults, links e templates: <https://help.obsidian.md/>
