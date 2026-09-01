---
description: Destila as issues de feedback abertas em atritos reais e propõe a classificação de cada um
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh label list:*), Read, Grep, Glob
---

# Triagem de feedback

Executa a etapa 2 do ciclo definido em `docs/development-process.md` §4. Leia aquela seção
antes de começar, porque ela é a fonte de verdade e este comando é apenas o roteiro.

## O que fazer

**1. Colete.** Liste as issues abertas com a label `feedback` e leia cada uma por inteiro,
incluindo os comentários:

```
gh issue list --label feedback --state open --json number,title,body,createdAt,labels
```

Se não houver nenhuma, diga isso e pare. Não invente trabalho.

**2. Agrupe por atrito, nunca por pedido.** Duas issues que pedem coisas diferentes podem
nascer do mesmo atrito, e é o atrito que se resolve. Um pedido de "botão de duplicar nota"
e outro de "importar de um arquivo" podem ser a mesma pessoa dizendo que criar a décima
nota parecida custa caro.

Ao agrupar, prefira o campo **"como você contornou"** ao campo "o que você faria": quem
contornou mediu a dor, e o contorno diz o tamanho dela.

**3. Para cada grupo, responda primeiro a pergunta que separa as saídas baratas das caras:**

> Isto se resolve **escrevendo**, ou só se resolve **construindo**?

Boa parte do que chega como falta de funcionalidade é falta de `README`. Antes de propor
construção, verifique se o assunto já está documentado: leia o `README.md` e procure no
`docs/software-vision.md` a regra que governa o comportamento reclamado. Se o produto já
faz o que a pessoa queria e ela não achou como, a saída é `tipo:documentacao`.

**4. Classifique cada grupo em uma das quatro saídas** de `development-process.md` §4.2:
`tipo:documentacao`, `tipo:defeito`, `tipo:lacuna` (ou `tipo:atrito`), ou recusa.

Um grupo é `tipo:defeito` quando o comportamento observado **diverge do que o
`software-vision.md` já afirma**. Confirme isso citando a `RN-XXX` contrariada; se nenhuma
regra existente cobre o caso, não é defeito, é lacuna.

**5. Atribua o bounded context** (`ctx:SUB`, `ctx:ACC`, `ctx:KNW`, `ctx:DSC`, `ctx:AUD`,
`ctx:AGT`, `ctx:PRT`, `ctx:UI`, `ctx:Infra`). Se um grupo cruza dois contextos, isso
normalmente significa que ele são dois grupos: separe.

## O que entregar

Uma proposta por grupo, em tabela, com estas colunas: o atrito destilado em uma frase, as
issues de origem, a saída proposta, o contexto, e a `RN-XXX` que precisaria ser criada ou
alterada (ou "nenhuma").

Depois da tabela, para cada grupo que você propõe **recusar**, escreva o rascunho do
comentário de recusa, dirigido a quem reportou e dizendo o motivo. A recusa é uma saída de
primeira classe: uma issue que fecha sem motivo escrito reabre a mesma discussão em seis
meses.

## O que não fazer

- **Não crie, não edite, não feche e não rotule issue nenhuma.** Este comando produz uma
  proposta para revisão humana. A aplicação da triagem é sempre uma decisão do usuário.
- **Não abra branch nem escreva código.** A implementação é a etapa 4, e ela começa depois
  que um escopo é fechado em uma issue de `proposta`.
- **Não trate cada issue como uma unidade de trabalho.** Se a saída for uma issue de
  roadmap por issue de feedback, a destilação não aconteceu.
- **Não invente demanda a partir de uma voz só.** Diga quando um grupo tem uma única
  origem: com poucos usuários, cada voz tem peso desproporcional, e o número de pessoas
  que sentiram o mesmo atrito é informação de priorização, não detalhe.
