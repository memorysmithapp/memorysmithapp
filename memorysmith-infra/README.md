# memorysmith-infra

Toda a infraestrutura do MemorySmith em AWS CDK (TypeScript): stacks, constructs e, futuramente, o pipeline. A arquitetura de referência vive em [`docs/architecture-guide.md`](../docs/architecture-guide.md); este README é o guia operacional para subir e derrubar os ambientes.

## O que existe hoje (escopo do spike, entrega 1 do §25)

O `bin/app.ts` instancia três stacks, na dependência abaixo:

| Stack | O que cria |
|---|---|
| `MemorysmithNetwork` | Referência à hosted zone `memorysmith.app` e certificado ACM de `mcp.memorysmith.app` (validação por DNS) |
| `MemorysmithIdentity` | User pool do Cognito (`memorysmith-users`), trigger provisório de pre-token-generation (injeta `subscription_id` e `subscription_status` no access token), domínio hospedado do Cognito, o app client único do proxy CIMD e um usuário de teste |
| `MemorysmithAgent` | Lambda do `svc-agent` (proxy CIMD + MCP server mínimo) atrás de um HTTP API no domínio `mcp.memorysmith.app`, com o segredo de correlação de state no Secrets Manager |

As demais stacks do desenho (§5.4 do guia) entram nas entregas seguintes.

## Pré-requisitos

1. **Node.js 22 ou superior** (`node --version`).
2. **pnpm 11**. Se o `corepack enable pnpm` falhar por permissão no Windows, instale com:
   ```
   npm install -g pnpm@11.22.0
   ```
3. **Conta AWS** com o domínio `memorysmith.app` delegado a uma hosted zone pública no Route 53.
4. **AWS CLI** (recomendado, usado nos passos de credencial e de senha do usuário de teste):
   ```
   winget install -e --id Amazon.AWSCLI
   ```
5. **Credenciais AWS na máquina**, por um dos caminhos:
   - `aws configure` (access key + secret + região padrão), ou
   - `aws configure sso` para contas com IAM Identity Center, ou
   - arquivo `~/.aws/credentials` criado manualmente com o profile `default`.

   O CDK usa a cadeia padrão de credenciais; nenhuma credencial entra em arquivo do repositório.

A região padrão do app é **`us-east-1`** (definida em `bin/app.ts`). Para usar outra, exporte `CDK_DEFAULT_REGION` antes dos comandos.

## Passo a passo

Todos os comandos abaixo rodam dentro de `memorysmith-infra/`.

### 1. Instalar as dependências

Na raiz do monorepo:

```
pnpm install
```

### 2. Preencher o contexto em `cdk.json`

Três valores de contexto governam o deploy:

| Chave | O que é | Como obter |
|---|---|---|
| `hostedZoneId` | O ID da hosted zone `memorysmith.app` (formato `Z...`) | Console do Route 53, ou `aws route53 list-hosted-zones-by-name --dns-name memorysmith.app --query "HostedZones[0].Id"` |
| `cognitoDomainPrefix` | Prefixo do domínio hospedado do Cognito, único globalmente na região | Manter `memorysmith-auth`; se o deploy acusar colisão, escolher outro |
| `testUserEmail` | E-mail do usuário de teste criado no user pool | O seu |

Edite os valores em `cdk.json` ou passe na linha de comando com `-c hostedZoneId=Z...` (o `-c` vence o arquivo).

**O `hostedZoneId` precisa ser o real antes de qualquer deploy.** O placeholder `Z_PLACEHOLDER_SET_ME` existe só para o `cdk synth` funcionar sem credenciais.

### 3. Bootstrap do CDK (uma vez por conta e região)

```
pnpm exec cdk bootstrap
```

Cria o bucket de assets e as roles que o CloudFormation usa. Se a conta já tem bootstrap de outro projeto, o comando é idempotente.

### 4. Validar a síntese

```
pnpm exec cdk synth --quiet
```

Precisa terminar sem erro. É o mesmo passo que o CI executará em todo PR.

### 5. Deploy

As stacks declaram dependências entre si, então o `--all` resolve a ordem sozinho:

```
pnpm exec cdk deploy --all
```

Ou, uma a uma, na ordem:

```
pnpm exec cdk deploy MemorysmithNetwork
pnpm exec cdk deploy MemorysmithIdentity
pnpm exec cdk deploy MemorysmithAgent
```

Notas de primeira execução:

- O certificado ACM valida por DNS na própria hosted zone; a emissão costuma levar de 2 a 10 minutos e o deploy da `MemorysmithNetwork` espera por ela.
- Ao final, a `MemorysmithAgent` imprime os outputs `McpEndpoint` (a URL pública do MCP) e `ApiId`.

### 6. Definir a senha do usuário de teste

O usuário de teste nasce com senha temporária enviada por e-mail. Para fixar uma senha definitiva sem passar pelo fluxo de troca:

```
aws cognito-idp admin-set-user-password --user-pool-id <ID do user pool> --username <e-mail do usuário de teste> --password "<senha forte>" --permanent
```

O ID do user pool aparece no console do Cognito ou em `aws cognito-idp list-user-pools --max-results 10`.

### 7. Verificar a subida

Checagens rápidas de descoberta (itens 1 e 2 do §13.3 do guia):

```
curl -i https://mcp.memorysmith.app/mcp
```

Deve responder `401` com o header `WWW-Authenticate: Bearer resource_metadata="https://mcp.memorysmith.app/.well-known/oauth-protected-resource"`.

```
curl https://mcp.memorysmith.app/.well-known/oauth-protected-resource
curl https://mcp.memorysmith.app/.well-known/oauth-authorization-server
```

O primeiro deve apontar `authorization_servers` para `https://mcp.memorysmith.app`; o segundo deve anunciar `client_id_metadata_document_supported: true`, PKCE `S256` e nenhum `registration_endpoint`.

### 8. Testar o fluxo OAuth completo com o MCP Inspector

```
npx @modelcontextprotocol/inspector
```

No Inspector: transporte **Streamable HTTP**, URL `https://mcp.memorysmith.app/mcp`, e iniciar a autenticação. O fluxo deve descobrir o authorization server, redirecionar ao login do Cognito (usuário de teste do passo 6), voltar com o token e listar a tool `whoami`. Chamar `whoami` deve devolver `sub`, `client_id`, `subscription_id` e `subscription_status`.

Em seguida, os dois clientes do critério de pronto da entrega 1:

- **Claude Desktop / Claude Code:** adicionar um conector remoto apontando para `https://mcp.memorysmith.app/mcp`.
- **claude.ai:** Settings → Connectors → Add custom connector, com a mesma URL.

### 9. Derrubar (quando necessário)

```
pnpm exec cdk destroy --all
```

O user pool e o secret têm política de remoção padrão; confira no console o que ficou retido antes de assumir que a conta está limpa.

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `Unable to resolve AWS account to use` | Credenciais ausentes ou expiradas na cadeia padrão |
| `This CDK CLI is not compatible...` | Use o CLI fixado no projeto (`pnpm exec cdk`), não um `cdk` global antigo |
| Deploy da `MemorysmithNetwork` parado em `CREATE_IN_PROGRESS` | Emissão do certificado aguardando a validação DNS; se passar de 30 minutos, confira se a hosted zone do `hostedZoneId` é a que responde pelo domínio |
| Colisão no domínio do Cognito | Troque `cognitoDomainPrefix` no contexto |
| `401` também nos endpoints `.well-known` | Rota errada ou domínio ainda propagando; os `.well-known` são públicos por desenho |
