# Runbooks de Produção

> [!info]
> Procedimentos operacionais do ambiente de produção: cada runbook é executável passo a passo, e todo incidente fechado vira postmortem ligado ao runbook que faltou.

## Regras de escrita

1. **Um procedimento por nota.** Pré-condições, passos numerados, verificação final. Se um passo exige julgamento, ele linka a nota que explica o critério.
2. **Postmortem é imutável depois de fechado.** Correção ou aprendizado novo vira nota nova, linkada ao postmortem original.
3. **Todo postmortem aponta o runbook que faltou** ou que falhou, e o runbook aponta de volta os incidentes em que foi usado.

## Frontmatter obrigatório

`title`, `aliases`, `tags`, `type` (`runbook` | `postmortem`), `maturity` (`seed` | `growing` | `evergreen`, reavaliada a cada escrita), `reviewed` (`true` somente após revisão humana da revisão vigente; qualquer edição posterior de conteúdo devolve a `false`), `source`, `author`, `created`.
