# Vaults de origem do onboard

As árvores commitadas em `../vaults/` são o que o `onboard.ps1` escreve, pela API do produto, no primeiro vault de uma conta nova. Elas estão no **formato de export do produto** (`docs/software-vision.md` §12): prefixo numérico codifica a ordem das pastas, `GUIDANCE.md` faz o papel de Guidance na raiz do vault, `STRUCTURE.md` ao lado dele carrega a árvore anotada com a descrição de cada pasta, `TEMPLATE.md` faz o papel de Template da pasta, e as notas são copiadas com o corpo byte a byte e os wikilinks intactos (PP4). No frontmatter, a tradução aplica o padrão de autoria comum aos três vaults reais: `maturity` (`seed`, `growing`, `evergreen`), reavaliado a cada escrita, e `reviewed`, que marca se a revisão vigente passou por revisão humana.

Escrever essas árvores pela API, e não direto no DynamoDB e no S3, é o que faz o ambiente recém-criado ter os mesmos eventos de domínio e a mesma trilha de auditoria que o produto teria produzido.

| Vault | Conteúdo | Notas |
|---|---|---|
| `engineering-knowledge` | Base de estudo de engenharia de software: literatura, conceitos e práticas atômicas, MOCs e projetos | ~573 |
| `regulacao-energia` | Regulação do setor elétrico brasileiro: normas, conceitos, fichas de dados abertos e o grafo de contexto (indicadores, séries, insights) | ~166 |
| `glpi-discovery` | Descoberta do GLPI 11 por engenharia reversa e documentação oficial, com contrato de evidência e investigações | ~758 |

Além desses três, cinco vaults fictícios pequenos (runbooks, onboarding, pesquisa de mercado, fermentação e jurisprudência) existem para dar ao onboard uma opção rápida, de poucos segundos, quando o que se quer é um ambiente de pé e não seiscentas notas.

## Layout

- `fictional/`: as fontes dos cinco vaults fictícios, que vivem no próprio repositório.
- `authoring/`: os textos autorais da tradução, por vault: `guidance.md` (vira o `GUIDANCE.md` da raiz) e `templates/*.md` (viram os `TEMPLATE.md` das pastas).
- `build-vaults.mjs`: o tradutor. Lê os vaults de origem, aplica o mapeamento de pastas e gera a saída. Os três vaults reais **não** fazem parte do repositório: eles vivem na máquina do autor, e o artefato commitado é a saída.
- `../vaults/`: a saída gerada, que é o que o onboard lê. Não editar à mão: alterações se fazem em `authoring/` ou na origem, seguidas de regeração.

## Regerar

```
node deploy-aws/vault-sources/build-vaults.mjs
```

O script valida os limites do produto (2.000 notas e 200 pastas por vault, profundidade 6, descrição de pasta entre 1 e 500 caracteres), detecta colisão de slug de nota dentro do vault e reporta avisos ao final.

Rodar sem os três vaults reais na máquina esvazia as três árvores correspondentes em `../vaults/`, porque o script recria cada saída do zero. Se você só quer regerar os fictícios, confira o `git status` antes de commitar.
