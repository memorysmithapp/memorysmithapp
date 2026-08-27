# Visão de Software: Plataforma MemorySmith.app

Este documento é a fonte da verdade para **o que o produto faz e sob qual regra**. Descreve visão, linguagem ubíqua, modelo de negócio de assinaturas, papéis, entidades de domínio, regras de negócio (`RN-XXX`), o contrato público de MCP, as telas e o recorte de cada versão.

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
15. [Recorte de versão](#15-recorte-de-versão)
16. [Riscos de produto](#16-riscos-de-produto)
17. [Questões em aberto](#17-questões-em-aberto)

---

## 1. Visão do produto

### 1.1 O problema

O fluxo que funciona hoje para trabalhar conhecimento com um agente é uma pasta local de arquivos `.md`, com um documento na raiz explicando ao agente como estruturar as notas, e um editor de vault por cima para navegar. O agente lê a pasta sempre que precisa de contexto.

Três coisas quebram nesse arranjo (detalhamento em `knowledge-base.md` §2.5):

1. **Colaboração:** o conteúdo é local, e duas pessoas não trabalham no mesmo corpo de conhecimento.
2. **Navegação compartilhada:** editores de vault são clientes locais, ruins como cliente de repositório remoto.
3. **Múltiplos cofres:** separar assuntos exige pastas soltas, sem um lugar que as liste.

### 1.2 A solução

**Cofres de conhecimento em Markdown, com estrutura declarada, acessíveis nativamente pelas ferramentas de IA.**

O MemorySmith.app é o backend remoto do fluxo que já funciona. Mantém o formato (Markdown puro), mantém a prática (orientação na raiz, molde por pasta) e resolve os três pontos de quebra, acrescentando o que a pasta local não tem: acesso remoto autenticado, colaboração com papéis, histórico defensável e descoberta por grafo e por significado.

### 1.3 O ciclo de uso

O agente não só lê o vault, ele o **alimenta**. O caso concreto que o produto serve:

1. **Ingestão.** O agente lê um corpo de material, como normas, legislação, documentação ou pesquisa, e escreve esse conhecimento como notas no vault, obedecendo ao Guidance (o que este vault é), à estrutura de pastas (onde cada coisa vai) e ao Template da pasta (como a nota se estrutura).
2. **Consumo.** Depois, outro trabalho, como uma auditoria, um relatório ou um parecer, usa o mesmo vault como base de conhecimento estruturada.

Três consequências atravessam o produto inteiro:

- **A escrita via MCP é o caminho de ingestão.** Quem popula o vault é o agente, por construção. Escrita não é funcionalidade secundária da API interna.
- **Guidance, estrutura e template são instruções executáveis, não documentação** (`knowledge-base.md` §4.2). São o que faz o agente escrever a nota certa, na pasta certa, no formato certo. Um Guidance fraco ou uma descrição de pasta vaga degrada a qualidade do que entra, e o efeito só aparece depois, no consumo.
- **O domínio é regulado.** O vault sustenta trabalho de auditoria, então proveniência e histórico são parte do produto (§11), não conformidade posterior.

### 1.4 A tese, em uma frase

O produto não é guardar `.md`, é **entregar contexto estruturado ao agente sem atrito**. Se ler um vault hospedado for mais trabalhoso que ler uma pasta local, o produto perdeu. Por isso o MCP não é acessório: é a interface principal, e a API interna existe para servir a UI.

### 1.5 Proposta de valor

| Para quem | Dor | O que o produto entrega |
|---|---|---|
| Quem trabalha com agente sobre um corpo de conhecimento | A pasta local não sai da máquina | Vault remoto, conectado nativamente ao cliente de IA |
| Times que compartilham uma base | Sincronizar arquivos não resolve edição concorrente | Assinatura com papéis e escrita com detecção de conflito |
| Trabalho regulado (auditoria, jurídico, compliance) | O parecer emitido não pode ser demonstrado com a base de ontem | Histórico por revisão, autoria de humano e agente, trilha imutável |
| Quem tem muitos assuntos | Pastas soltas, sem catálogo | Lista de vaults com descrição, cada um autônomo |
| Quem teme lock-in | Base é ativo de longo prazo | Export de `.md` puros, sem formato proprietário |

### 1.6 Slogan

**Structured knowledge, natively readable and writable by agents.**

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
| **Guidance** | O **papel** de "para que serve este vault e como estruturar as notas", desempenhado por um documento apontado pelo vault | Um arquivo chamado `README.md` |
| **Folder** | Nó ordenado da árvore do vault, com `description` que diz *o que se guarda ali* | Diretório físico (não existe) |
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
| **Vault Context** | Documento composto (Guidance mais árvore anotada) entregue ao agente | Dump do vault |
| **Content Slot** | Um documento Markdown armazenado, endereçado por identificador opaco. Nota, guidance e template são o **mesmo** tipo de coisa; o que difere é quem aponta para ele | Arquivo, caminho |
| **Content Role** | O significado atribuído a um slot: `body` (nota), `guidance` (vault) ou `template` (pasta) | Nome de arquivo reservado |
| **Vínculo** | A relação `(usuário, assinatura)` que autoriza aquele usuário a atuar naquela assinatura | Membership |
| **Assinatura Ativa** | A assinatura em cujo nome a sessão age agora, escolhida entre os vínculos | O conjunto das assinaturas do usuário |
| **Membership** | A relação `(usuário, assinatura)` com papel `EDITOR` ou `VIEWER` | Vínculo, que diz apenas que o usuário alcança a assinatura |
| **Vault Role Limit** | O teto de papel de um membro num vault específico. Só rebaixa, nunca promove | Papel próprio do vault |
| **Expurgo** | Destruição deliberada do conteúdo de um Content Slot, com motivo e autorização registrados | Apagar uma nota |

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
| **Signup** | Cria a conta de usuário. Nenhuma assinatura ainda, nenhum acesso operacional |
| **Onboarding** | O usuário solicita uma assinatura e passa a ser o `OWNER` dela. Status: `pending_approval` |
| **Autorização** | Um `PLATFORM_ADMIN` aprova (status vira `trial` ou `active`) ou rejeita, com motivo obrigatório |
| **Configuração** | O `OWNER` cria vaults e escreve Guidance e Templates |
| **Convite** | O `OWNER` convida por e-mail para a assinatura, definindo `EDITOR` ou `VIEWER` |
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

O que ele vê é metadado de assinatura: titular, e-mail, status, datas e contagem de membros. Nunca nome de vault, nunca conteúdo de nota.

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
| Ativar retenção legal | — | ● | — | — |
| Expurgar conteúdo | — | ● | — | — |

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
- **RN-ACC-005:** O convite é de uso único, vinculado ao e-mail para o qual foi enviado, e expira em 7 dias.
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
- **RN-ACC-016:** Alterações de papel, de teto e remoções podem levar até 5 minutos para surtir efeito em sessões já autenticadas. Esse atraso é declarado ao usuário nas telas de membros e de vault.

---

## 6. Mapa de domínios

Seis bounded contexts. A separação é de responsabilidade e vocabulário; a forma de deploy é decisão de engenharia (`architecture-guide.md` §3 e §17).

| Contexto | Responsabilidade | Tipo |
|---|---|---|
| **Access** | Assinaturas e seu ciclo de vida, membros, papéis, tetos de vault, convites, vínculos, autorização | Supporting |
| **Knowledge** | Vaults, guidance, pastas, ordem, templates, notas | **Core** |
| **Discovery** | Grafo de links, índice de texto e facetas de curadoria, três projeções | Supporting |
| **Audit** | Trilha append-only: autoria, revisões, reconstrução por data | Supporting |
| **Agent Access** | O MCP server; compõe o Vault Context; traduz domínio ↔ tools | Supporting (camada anticorrupção) |
| **Portability** | Export para árvore de arquivos legível | Generic |

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
name, slug,
owner_id,                    -- exatamente um, sempre presente (RN-ACC-001)
status (pending_approval | trial | active | rejected | suspended | canceled),
requested_at,
reviewed_by_id?, reviewed_at?,
rejection_reason?,           -- obrigatório quando status = rejected (RN-SUB-009)
legal_hold_enabled (bool),   -- retenção legal; ver RN-AUD-009
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

Daí decorre a regra de produto mais contraintuitiva do sistema: **`README.md` e `TEMPLATE.md` não são nomes de arquivo, são papéis.** Não existe nome reservado no armazenamento. Nomes de arquivo só voltam a existir na borda, no export (§12) e na UI.

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
- **RN-KNW-024:** Mover uma nota para fora de um vault **quebra todos os backlinks que apontavam para ela naquele vault**. É consequência semântica correta (PP2), e a UI avisa quantos links serão quebrados antes de confirmar.
- **RN-KNW-025:** Uma nota tem no máximo 1 MB de conteúdo.
- **RN-KNW-026:** Toda operação que altera estado registra autoria completa: o humano responsável e, quando houver, o agente que executou. Não existe alteração anônima.
- **RN-KNW-027:** Toda alteração de conteúdo gera uma revisão nova, imutável, referenciada pelo evento correspondente.
- **RN-KNW-028:** Se o conteúdo enviado for byte a byte idêntico ao atual, não há nova revisão, não há evento e não há reindexação.
- **RN-KNW-029:** Apagar uma nota é reversível: a nota sai das listagens e da busca, e o histórico permanece consultável pelo identificador da nota.
- **RN-KNW-030:** Apagar uma nota libera o seu `slug` no vault; restaurá-la exige que o slug esteja livre novamente.
- **RN-KNW-031:** O backend não valida a nota contra o Template da pasta (PP3), e não interpreta frontmatter nem qualquer convenção de conteúdo (PP4).

---

## 9. Domínio: Agent Access (o contrato público)

**O MCP é o contrato público do produto.** A API interna (`architecture-guide.md` §12) existe para servir a UI. É o catálogo de tools abaixo que os clientes externos consomem, e é ele que a política de versionamento protege (`CLAUDE.md` § Política de versionamento).

### 9.1 Catálogo de tools

| Tool | Assinatura | Papel |
|---|---|---|
| `whoami` | `()` | Quem está agindo, o que a conexão alcança e **como escrever aqui**: a ordem de leitura do vault e o catálogo inteiro |
| `list_vaults` | `()` | Vaults visíveis, com descrição |
| **`get_vault_context`** | `(vault)` | **A chamada principal.** Guidance integral mais árvore com descrições, ordem, contagem de notas e quais pastas têm template |
| `get_template` | `(vault, folder)` | O Template da pasta, a ler antes de escrever |
| `list_notes` | `(vault, folder?)` | Índice de notas, na ordem definida |
| `read_note` | `(vault, note, asOf?)` | Markdown completo e a revisão corrente; com `asOf`, a revisão vigente naquela data |
| `create_note` | `(vault, folder, title, content)` | O caminho de ingestão (§1.3) |
| `update_note` | `(vault, note, content, baseRevision)` | Atualização com detecção de conflito |
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
- **RN-AUD-007:** Destruir conteúdo (**expurgo**) é ato administrativo restrito ao `OWNER`, exige motivo obrigatório e gera evento próprio. A trilha passa a registrar *"aqui houve apagamento, por este motivo, autorizado por esta pessoa"*, porque uma lacuna silenciosa não é resposta aceitável a um regulador.
- **RN-AUD-008:** O `OWNER` pode ativar retenção legal para a assinatura, que trava as revisões contra remoção pelo prazo configurado.
- **RN-AUD-009:** Retenção legal e expurgo são incompatíveis por desenho: com retenção ativa, o expurgo é recusado. Obrigação legal de retenção vence pedido de apagamento (`knowledge-base.md` §7.5), e o produto declara isso na tela em que a retenção é ativada, não no incidente.

---

## 12. Domínio: Portability

Zero lock-in é requisito, não cortesia: é o que torna o produto seguro de adotar num contexto em que a base precisa sobreviver ao fornecedor (`knowledge-base.md` §10).

**O export é onde os nomes de arquivo passam a existir.** Dentro do sistema há identificadores opacos e papéis (§8.1); é aqui que `guidance` vira `README.md`, `template` vira `TEMPLATE.md` e o slug da nota vira nome de arquivo.

```
Normas e Legislação/
├── README.md
├── 01 Normas/
│   ├── README.md            ← a descrição da pasta, materializada
│   ├── TEMPLATE.md
│   └── lei-14133-art-75.md
├── 02 Achados/
│   ├── README.md
│   └── TEMPLATE.md
└── 03 Trabalhos/
    └── 01 2026/
```

- **RN-PRT-001:** O export contém apenas arquivos `.md`, sem componente proprietário e sem índice obrigatório para leitura.
- **RN-PRT-002:** A ordem de pastas e de notas é codificada como prefixo numérico no nome, que é a única forma de preservá-la num sistema de arquivos, já que ele não tem ordem própria.
- **RN-PRT-003:** A descrição de cada pasta é materializada como `README.md` dentro dela.
- **RN-PRT-004:** Os links saem intactos no texto das notas.
- **RN-PRT-005:** Uma nota cujo slug seja exatamente `readme` ou `template` é exportada com sufixo, e todos os links para ela são reescritos junto. É a única concessão do export, e ela pertence à borda, não ao modelo.
- **RN-PRT-006:** Notas apagadas não entram no export.

---

## 13. Interface da aplicação

**A UI é a única superfície de leitura humana do produto.** Isso levanta a régua da tela de nota e da árvore: elas precisam ser confortáveis para **ler**, não só para editar.

### 13.1 Telas

**Onboarding e plataforma**

| Tela | Conteúdo |
|---|---|
| Entrada sem assinatura ativa | Não existe tela de espera dentro do produto. Uma sessão cuja assinatura está ausente, aguardando aprovação ou bloqueada não alcança nada, então ela é encerrada e a pessoa volta à tela de entrada com a mensagem do seu caso: conta sem assinatura, assinatura aguardando autorização ou assinatura inativa. A distinção é deliberada, porque "não há nada aqui" e "seu acesso está suspenso" são fatos diferentes |
| Solicitação de assinatura | Fora do produto nesta fase. A rota existe na API, e quem solicita e aprova é a operação da plataforma; a interface não oferece o formulário |
| **Plataforma → Assinaturas** | Área do `PLATFORM_ADMIN`: fila de pendentes, aprovar (`trial` ou `active`), rejeitar com motivo, suspender e reativar. Mostra titular, e-mail, datas e contagem de membros, **nunca nome de vault nem conteúdo** (§4.6) |

**Assinatura**

| Tela | Conteúdo |
|---|---|
| Assinatura → Membros | Convidar por e-mail definindo `EDITOR` ou `VIEWER`, alterar papel, remover; declara o atraso de propagação (RN-ACC-016) |
| Assinatura → Titularidade | Transferir a titularidade para outro membro, com confirmação explícita de que o titular atual vira `EDITOR` |

**Conhecimento**

| Tela | Conteúdo |
|---|---|
| Lista de vaults | Cards: nome, descrição, nº de notas, última atualização |
| Vault → Guidance | Editor Markdown com preview; ajuda sugerindo seções (propósito, convenções, nomenclatura) |
| Vault → Estrutura | Árvore com arrastar-e-soltar para reordenar e mover pastas **e** notas; criar e renomear pasta; editar descrição inline |
| Mover nota entre vaults | Ação explícita, não arrastar-e-soltar: mostra antes quantos backlinks vão quebrar e pede confirmação (RN-KNW-024) |
| Pasta → Template | Editor do Template da pasta |
| Nota | Leitura e edição; painel lateral com backlinks e relacionadas |
| Nota → Histórico | Linha do tempo com autoria (humano e agente) e diferença entre revisões |
| Vault → Busca | Campo único sobre o texto do vault, aceitando campos e operadores |
| Vault → Atividade | Quem escreveu o quê no período, em visão de vault e não de nota |
| Vault → Saúde | Links quebrados e notas órfãs |
| Vault → Acesso | Lista os membros da assinatura e permite rebaixar um `EDITOR` a `VIEWER` **neste vault** (§5.3). Mostra o papel efetivo de cada um, não só o teto |
| Vault → Conectar | URL do MCP e passo a passo por cliente |
| Configurações da assinatura | Titularidade, transferência, retenção legal, expurgo e troca de assinatura ativa, que só aparecem quando aplicáveis (PP8) |

### 13.2 Regras de interface

- A troca de assinatura só aparece para quem tem mais de um vínculo (§4.5).
- A área de plataforma é uma superfície à parte, alcançada por sessão própria; nenhuma tela de conteúdo tem versão "de admin" (§4.6).
- Uma assinatura fora de `trial` ou `active` encerra a sessão e leva o usuário de volta à tela de entrada com a mensagem do seu caso, e nunca a uma tela de conteúdo vazia. A mensagem diz qual dos três casos é, porque a diferença entre "não há nada aqui" e "seu acesso está suspenso" é a diferença entre um bug aparente e uma informação.
- Toda operação destrutiva ou de efeito não óbvio, como mover nota entre vaults, remover pasta com conteúdo, transferir titularidade, ativar retenção legal e expurgar, mostra a consequência **antes** de confirmar, com número concreto quando houver.
- Onde o papel efetivo difere do papel na assinatura por causa de um teto de vault (§5.3), a UI mostra o efetivo e explica a origem, porque um `EDITOR` que não consegue escrever precisa saber por quê.

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

## 15. Recorte de versão

### 15.1 Escopo da 0.1.0

Este documento descreve o produto; a 0.1.0 é o recorte que **testa a tese** (§1.4) e nada além dela: um vault escrito por um agente e lido por um agente, com o passado registrado desde o primeiro dia.

| Dentro | Fora |
|---|---|
| Autenticação do conector MCP, bloqueante | Discovery inteiro: grafo, busca semântica e facetas (§10) |
| Vault, pastas, ordem, guidance, template, nota | Export (§12) |
| Onboarding de assinatura, aprovação pelo `PLATFORM_ADMIN`, autorização | Mover nota entre vaults |
| Auditoria: trilha, `note_history`, `read_note(asOf)` | Convites, `EDITOR`/`VIEWER` e teto por vault (§5.3) |
| MCP com 8 tools: `whoami`, `list_vaults`, `get_vault_context`, `get_template`, `list_notes`, `read_note`, `create_note`, `update_note` | `search_notes`, `semantic_search`, `related_notes`, `backlinks` |
| UI de autoria: vault, pastas, guidance, template, nota | Retenção legal e expurgo · telas de saúde, atividade e membros |
| Área de plataforma: fila de assinaturas, aprovar e rejeitar | Suspensão, reativação e transferência de titularidade |

Três inclusões que parecem contradizer o recorte, e não contradizem:

- **A auditoria entra.** É contexto "supporting", mas evento não gravado no dia 1 é passado que não se recupera depois. Registrar é barato; retroagir é impossível.
- **A UI de autoria entra.** Sem Guidance e Template escritos por um humano, não existe nada para o agente ler, e a tese não é testável. É o menor pedaço de UI que fecha o ciclo.
- **A aprovação de assinatura entra.** Sem billing, ela é o único portão de entrada: sem ela ninguém acessa nada, e a 0.1.0 não teria como ser usada por um primeiro cliente real. O que fica de fora é o resto do ciclo de vida, ou seja suspender, reativar e transferir.

**O que a 0.1.0 assume, e que precisa estar declarado:** a assinatura tem um `OWNER` e nenhum outro membro. A colaboração inteira, com convites, `EDITOR`, `VIEWER` e teto por vault, chega na 0.2.0 (§15.2). O modelo de papéis já existe no domínio desde a primeira linha (PP8); o que não existia na 0.1.0 é a superfície que o exercita.

### 15.2 Depois da 0.1.0

A 0.2.0 fecha o produto descrito neste documento: os seis bounded contexts, a infraestrutura inteira e a interface ligada à API real. Ela entrega, além do recorte da 0.1.0, o Discovery completo (grafo de links, busca literal no texto com linguagem de consulta e facetas de curadoria), as quatro tools de descoberta, a colaboração (convites, `EDITOR`, `VIEWER` e teto de papel por vault), o ciclo de vida completo da assinatura (suspender, reativar, cancelar e transferir titularidade), mover nota entre vaults e a portabilidade.

| Versão | Tema |
|---|---|
| 0.2.0 | O produto completo: Discovery, colaboração, ciclo de vida da assinatura, portabilidade e a interface sobre a API real |
| 0.3.0 | Conformidade: retenção legal, expurgo e relatórios de saúde |

O que fica declaradamente fora da 0.2.0 é a conformidade formal, ou seja a retenção legal (RN-AUD-008), o expurgo de conteúdo (RN-AUD-007) e os relatórios que os sustentam. Os três são atos administrativos com porta própria e evento próprio, e nenhum deles é pré-requisito de nada que já existe: adiar não cobra juros, porque a trilha que eles governam já está sendo escrita desde o primeiro dia.

A ordem técnica de construção, com critérios de pronto, está em `architecture-guide.md` §25.

---

## 16. Riscos de produto

| Risco | Impacto | Resposta |
|---|---|---|
| Conectar o vault ao cliente de IA ser penoso | **Alto, mata a tese** | É a primeira coisa a ser provada, antes de qualquer outra: se a conexão não for fluida, o produto não se sustenta |
| Vazamento entre assinaturas | **Alto** | Assinatura na chave de todo dado, tipo obrigatório no código e teste de isolamento na suíte |
| Guidance e Template fracos degradarem a base sem ninguém perceber | **Alto** | A UI de autoria orienta as seções esperadas; a descrição de pasta é obrigatória; o relatório de saúde expõe o apodrecimento |
| Dois agentes sobrescreverem a mesma nota | Médio | `baseRevision` obrigatório; conflito devolve o conteúdo atual (RN-AGT-005) |
| Retry de transporte duplicar nota na ingestão | Médio | Slug único no vault faz a idempotência; `ALREADY_EXISTS` devolve o identificador existente, nunca gera sufixo (RN-AGT-004) |
| Busca devolver plausível-porém-errado | Médio | Sempre citar a nota de origem; o agente decide com a fonte à vista (RN-DSC-010) |
| Busca literal não achar a nota que fala do assunto com outras palavras | Médio | Risco assumido na 0.2.0 (§10.2): a busca acha o que está escrito, e quem procura por assunto usa o grafo e as facetas. É o que o MVP vai medir com um vault real |
| Apagar nota destruir o histórico prometido | **Alto** | Soft delete; destruição de bytes fora do domínio, como ato administrativo com evento (RN-AUD-007) |
| Usuário em duas assinaturas agir na assinatura errada | **Alto** | Assinatura ativa explícita; conector fixa a assinatura no consentimento (RN-SUB-014) |
| Cancelamento virar perda ou migração de dados | **Alto** | `SubscriptionId` perpétuo: status controla acesso, nunca endereço (RN-SUB-005). Reativar é mudar um campo |
| `PLATFORM_ADMIN` alcançar conteúdo de cliente | **Alto** | Sessão de plataforma não carrega assinatura ativa, então não há chave que ela consiga montar (RN-SUB-016); teste na suíte |
| Aprovação manual virar gargalo de entrada | Médio | Fila visível com data de solicitação; enquanto não há billing, é o custo aceito da decisão de adiar cobrança |
| `OWNER` indisponível travar a assinatura | Médio | Transferência de titularidade é operação de primeira classe (RN-ACC-002). O caso de indisponibilidade total segue em aberto (Q3) |
| Grafo explodir em vault denso | Médio | Teto de profundidade e de nós na travessia (RN-DSC-007) |
| Base crescer além dos limites declarados | Médio | Limites em §14 viram teste e aviso na UI; `get_vault_context` trunca com aviso |

Riscos técnicos e de infraestrutura estão em `architecture-guide.md` §19.

---

## 17. Questões em aberto

Registradas aqui em vez de decididas por omissão. Cada uma vira uma decisão datada quando for resolvida.

| # | Questão | Por que ainda não foi decidida |
|---|---|---|
| Q1 | **Planos, cobrança e limites por plano** | Não há definição comercial. Os limites de §14 são técnicos, não de plano. A entidade `Subscription` já comporta plano e cobrança quando houver decisão |
| Q2 | **Identidade visual:** cor primária, logotipo, tom | **Resolvida.** Sistema de marca definido no caderno "Livro da marca v1" (Figma): paleta, tipografia, símbolo e regras de uso registrados em `CLAUDE.md` § Identidade visual |
| Q3 | **Continuidade quando o `OWNER` some** | A transferência exige o próprio `OWNER` (RN-ACC-002). Se ele fica indisponível, hoje só o `PLATFORM_ADMIN` resolveria, e o fluxo não está desenhado |
| Q4 | **Vault público ou compartilhável por link** | Não está no escopo; entraria como um quarto papel, o que exige revisitar a matriz de §5.2 |
| Q5 | **Anexos não-Markdown (imagens, PDFs)** | Contradiz PP1 na forma atual. Se entrar, entra como Content Slot de outro tipo, sem virar exceção no modelo |
| Q6 | **Painel de curadoria e a interpretação de convenções de frontmatter** | **Resolvida.** O painel é a projeção de facetas do Discovery (§10.3, RN-DSC-017 a RN-DSC-024): `maturity` e `reviewed` viram convenção de produto; os demais atributos, definidos pelo Guidance de cada vault, são descobertos pela forma do valor (data, booleano, valor enumerável, lista), com texto livre descartado; e quem lê o frontmatter é o projetor, nunca o core |
