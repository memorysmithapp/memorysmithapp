# MemoryVault.guru

Cofres de conhecimento em **Markdown**, com estrutura declarada, acessíveis nativamente pelas ferramentas de IA.

O agente não só lê o vault, ele o **alimenta**. Lê um corpo de normas e escreve o conhecimento como notas, obedecendo às orientações do próprio vault; depois, outro trabalho usa essa base para produzir um relatório ou uma auditoria.

---

## Como um vault é organizado

```
Vault
├── README.md          ← Guidance: para que serve este vault e como estruturar as notas
└── Pastas (ordenadas) ── cada uma com uma descrição: o que se guarda aqui
    ├── TEMPLATE.md    ← como as notas desta pasta se estruturam
    ├── subpastas
    └── notas .md
```

`README.md` e `TEMPLATE.md` não são documentação: são **instruções executáveis**. São o que faz o agente escrever a nota certa, na pasta certa, no formato certo.

E não são nomes de arquivo. São **papéis**: o vault aponta um documento como seu Guidance, a pasta aponta outro como seu Template. Os nomes só aparecem na borda, no export e na UI.

## Interface

O contrato público é um **MCP server remoto** (OAuth 2.1), conector nativo em Claude web, desktop, Code, Cowork e CLI. A chamada central é `get_vault_context`, que devolve o Guidance integral mais a árvore anotada com descrições e ordem. É o equivalente a ler o README e rodar `ls -R` na pasta local, em uma única chamada.

Sobre isso: grafo de links (árvore de dependências e backlinks), busca semântica, histórico por revisão e uma UI de autoria.

## Documentação

A especificação está dividida em três documentos com responsabilidades que não se sobrepõem. Cada fato é declarado em exatamente um deles e referenciado pelos outros:

| Documento | Responde |
|---|---|
| **[docs/knowledge-base.md](docs/knowledge-base.md)** | O que é verdade sobre o domínio, independentemente deste produto |
| **[docs/software-vision.md](docs/software-vision.md)** | O que o produto faz e sob qual regra |
| **[docs/architecture-guide.md](docs/architecture-guide.md)** | Como é construído |

**[CLAUDE.md](CLAUDE.md)** reúne as orientações de trabalho no repositório.

## Estado

Fase de design. Ainda não há código.

O primeiro passo é um spike de autenticação: conectar um MCP mínimo autenticado por Cognito no Claude Desktop e no Claude web. É a decisão de maior risco do projeto, porque se a conexão não for fluida a tese não se sustenta.

## Licença

MIT. Ver [LICENSE](LICENSE).
