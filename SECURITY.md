# Política de segurança

## Como reportar

**Nunca abra uma issue pública para uma falha de segurança.** Este repositório é público, e
uma issue descrevendo como alcançar dado de outra conta é uma instrução de exploração à
vista de todo mundo enquanto a correção não sai.

Use o canal privado do GitHub:

> **Security → Advisories → Report a vulnerability**
> [github.com/memorysmithapp/memorysmithapp/security/advisories/new](https://github.com/memorysmithapp/memorysmithapp/security/advisories/new)

Só quem mantém o repositório enxerga o relato, e a conversa acontece ali até existir
correção publicada.

O canal vale para os dois modos. Um relato sobre **instalação própria** informa a versão
instalada e diz que é instalação própria, porque a instância hospedada é observável por
quem mantém o projeto e a de terceiro não é.

## O que reportar por aqui

Qualquer coisa que quebre uma das garantias abaixo é falha de segurança, mesmo que pareça
pequena e mesmo que você não tenha certeza:

| Você observou | Por que é grave |
|---|---|
| Conteúdo, nome de vault, nota ou membro de **outra assinatura** | O isolamento por assinatura é a garantia central do produto: toda chave de dado começa pela assinatura, e nenhuma requisição pode escolher qual |
| Um recurso que não é seu respondendo **`403`** em vez de `404` | O `403` confirma que aquilo existe, e essa confirmação já é vazamento |
| Uma sessão de administrador de plataforma alcançando **conteúdo de cliente** | Um token de plataforma não carrega assinatura, então não deveria existir chave que ele consiga montar |
| Um registro da **trilha de auditoria** alterado ou apagado | A trilha é append-only por política de IAM, não por disciplina |
| Um **token do conector MCP** aceito fora da assinatura que o consentiu | O consentimento fixa a assinatura, e o token não deveria valer em outra |
| Bytes de nota **destruídos** por qualquer operação | Apagar é sempre reversível, e nada no produto destrói uma revisão: não existe porta, rota nem ato administrativo que o faça |
| Qualquer credencial, chave ou segredo exposto no repositório ou em resposta da API | |

Vale reportar mesmo que você tenha topado com isso por acidente e não saiba reproduzir.
Um relato impreciso de vazamento vale mais que um silêncio educado.

## O que **não** é caso para este canal

Atrito de uso, funcionalidade faltando, defeito que não vaza dado nem quebra autorização,
e dúvida sobre instalação seguem pelo caminho normal:
[abrir uma issue de feedback](https://github.com/memorysmithapp/memorysmithapp/issues/new?template=01-feedback.yml).

## Conteúdo de vault em relatos

Ao reportar, **não cole conteúdo real das suas notas**, nomes de cliente ou dados de
negócio, nem aqui nem em issue pública. Descreva a forma do problema com exemplos
inventados, e mande identificadores (`vaultId`, `noteId`) em vez de texto. Se a correção
depender de ver o conteúdo, pedimos por um caminho combinado.

## Resposta

Este é um projeto pequeno, e prometer prazo que não se cumpre é pior que não prometer.
O compromisso é: **acusar o recebimento em até 72 horas** e manter você informado no
próprio advisory até existir correção ou uma decisão registrada de não corrigir, com o
motivo.

## Versões cobertas

O produto está em `0.x` e é implantado como uma versão única nos três projetos. Só a
versão publicada mais recente recebe correção; não há backport para versões anteriores
enquanto a `1.0.0` não existir.

Isso vale para os dois modos de operação (`software-vision.md` §4.9). **Quem roda a própria
instância recebe a correção pelo repositório e é responsável por aplicá-la:** não há
atualização automática e não há aviso dirigido a quem instalou.
