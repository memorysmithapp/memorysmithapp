---
title: EV-1-004 · Kernel Symfony MicroKernel envolve o legado
aliases: [EV-1-004]
tags: [evidence, dominio/foundation, arquitetura, bootstrap]
type: evidence
maturity: evergreen
reviewed: false
source: "SRC-001 · codebase/in/glpi/src/Glpi/Kernel/Kernel.php · linhas 35–81"
author: CAD Discovery
created: 2026-07-10
---

# EV-1-004 · Kernel Symfony MicroKernel envolve o legado

> [!quote] `src/Glpi/Kernel/Kernel.php` (L35–81, resumido)
> ```php
> namespace Glpi\Kernel;
> use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
> use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
> use Symfony\Bundle\TwigBundle\TwigBundle;
> use Symfony\Component\HttpKernel\Kernel as BaseKernel;
>
> final class Kernel extends BaseKernel {
>     use MicroKernelTrait;
>     public function __construct(?string $env = null) {
>         $configurator = new SystemConfigurator($this->getProjectDir(), $env);
>         $env = Environment::get();
>         parent::__construct($env->value, debug: $env->shouldExpectResourcesToChange());
>     }
> }
> ```

O GLPI 11 é uma **arquitetura híbrida**: um `Kernel` Symfony (MicroKernelTrait, FrameworkBundle,
TwigBundle, WebProfilerBundle) faz o bootstrap moderno (DI container, routing, Twig), mas
convive com o núcleo legado procedural/active-record (`CommonDBTM` e as ~1.500 classes
diretamente em `src/*.php`). Código novo vive no namespace `Glpi\` em `src/Glpi/`.

## Sustenta
- [[Kernel e Bootstrap]]
- [[Organização do código-fonte]]
- [[ADR - Arquitetura híbrida Symfony + Active Record legado]]
