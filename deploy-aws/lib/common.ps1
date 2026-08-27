#Requires -Version 7.0
<#
.SYNOPSIS
  Shared helpers for the deploy-aws scripts.

.DESCRIPTION
  Console output, the environment preflight, and thin wrappers around the AWS
  CLI and the CDK CLI. Dot-source this file; it only defines functions and the
  module level constants they need.
#>

$ErrorActionPreference = 'Stop'

# --- Layout ------------------------------------------------------------------

$Global:MsRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$Global:MsInfraDir = Join-Path $Global:MsRepoRoot 'memorysmith-infra'
$Global:MsFrontendDir = Join-Path $Global:MsRepoRoot 'memorysmith-frontend'

<#
  The deploy order is the one declared in memorysmith-infra/bin/app.ts. The CDK
  resolves dependencies on its own, but the list is explicit here so the
  frontend stack can be deployed AFTER the SPA is built, which is the one
  ordering the CDK cannot infer.
#>
$Global:MsBackendStacks = @(
  'MemorysmithNetwork',
  'MemorysmithData',
  'MemorysmithIdentity',
  'MemorysmithApi',
  'MemorysmithProjections',
  'MemorysmithAgent'
)
$Global:MsFrontendStack = 'MemorysmithFrontend'
$Global:MsAllStacks = $Global:MsBackendStacks + $Global:MsFrontendStack

# Table names are fixed in data.stack.ts, so a retained table blocks a redeploy.
$Global:MsDataTables = @('mv-access', 'mv-knowledge', 'mv-discovery', 'mv-audit')

$Global:MsAws = @{ Region = $null; Profile = $null }

# --- Console -----------------------------------------------------------------

function Write-Step {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "  [ ok ] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "  [warn] $Message" -ForegroundColor Yellow
}

function Write-Gap {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "  [gap ] $Message" -ForegroundColor Red
}

function Write-Detail {
  param([Parameter(Mandatory)][string]$Message)
  Write-Host "         $Message" -ForegroundColor DarkGray
}

# --- Small utilities ---------------------------------------------------------

function Test-CommandExists {
  param([Parameter(Mandatory)][string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-ToolVersion {
  <# Runs the version flag of a command and returns the first x.y.z, or null. #>
  param([Parameter(Mandatory)][string]$Command, [string[]]$VersionArgs = @('--version'))
  if (-not (Test-CommandExists $Command)) { return $null }
  $raw = ''
  try {
    $raw = & $Command @VersionArgs 2>&1 | Out-String
  } catch {
    return $null
  }
  $match = [regex]::Match($raw, '(\d+)\.(\d+)\.(\d+)')
  if (-not $match.Success) { return $null }
  return [version]::new(
    [int]$match.Groups[1].Value,
    [int]$match.Groups[2].Value,
    [int]$match.Groups[3].Value
  )
}

function New-Check {
  <#
    One line of the preflight report. Status is 'ok', 'warn' or 'gap'; only a
    'gap' stops a run.
  #>
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][ValidateSet('ok', 'warn', 'gap')][string]$Status,
    [string]$Detail = '',
    [string]$Fix = ''
  )
  return [pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail; Fix = $Fix }
}

function Write-CheckLine {
  param([Parameter(Mandatory)][psobject]$Check)
  $label = '{0,-20}' -f $Check.Name
  switch ($Check.Status) {
    'ok' { Write-Ok "$label $($Check.Detail)" }
    'warn' { Write-Warn "$label $($Check.Detail)" }
    'gap' { Write-Gap "$label $($Check.Detail)" }
  }
  if ($Check.Fix -and $Check.Status -ne 'ok') { Write-Detail "fix: $($Check.Fix)" }
}

function Write-CheckReport {
  <#
    Prints every check and returns the number of gaps. A warning is printed and
    the run continues; a gap is a missing precondition and stops the caller.
  #>
  param([Parameter(Mandatory)][AllowEmptyCollection()][psobject[]]$Checks)
  foreach ($check in $Checks) { Write-CheckLine $check }
  $gaps = @($Checks | Where-Object { $_.Status -eq 'gap' })
  $warns = @($Checks | Where-Object { $_.Status -eq 'warn' })
  Write-Host ''
  Write-Host ("  {0} checks, {1} gap(s), {2} warning(s)" -f $Checks.Count, $gaps.Count, $warns.Count)
  return $gaps.Count
}

# --- AWS ---------------------------------------------------------------------

function Set-AwsContext {
  <#
    Resolves the region and profile once, for both the AWS CLI calls made here
    and the CDK process spawned later. The CDK reads CDK_DEFAULT_REGION, and
    the SDK inside it reads AWS_REGION and AWS_PROFILE.
  #>
  param([string]$Region, [string]$ProfileName)

  if (-not $Region) { $Region = $env:CDK_DEFAULT_REGION }
  if (-not $Region -and (Test-CommandExists 'aws')) {
    if ($ProfileName) {
      $Region = (& aws configure get region --profile $ProfileName 2>$null)
    } else {
      $Region = (& aws configure get region 2>$null)
    }
  }
  if (-not $Region) { $Region = 'us-east-1' }

  $Global:MsAws.Region = "$Region".Trim()
  $Global:MsAws.Profile = $ProfileName

  $env:CDK_DEFAULT_REGION = $Global:MsAws.Region
  $env:AWS_REGION = $Global:MsAws.Region
  $env:AWS_DEFAULT_REGION = $Global:MsAws.Region
  if ($ProfileName) { $env:AWS_PROFILE = $ProfileName }
}

function Invoke-Aws {
  <#
    Calls the AWS CLI with the resolved profile and region and parses the JSON
    answer. With -AllowFailure a non-zero exit returns null instead of
    throwing, which is how the preflight asks "does this exist?".
  #>
  param(
    [Parameter(Mandatory)][string[]]$Arguments,
    [switch]$AllowFailure,
    [switch]$Raw
  )
  $all = @($Arguments)
  if ($Global:MsAws.Profile) { $all += @('--profile', $Global:MsAws.Profile) }
  if ($Global:MsAws.Region) { $all += @('--region', $Global:MsAws.Region) }
  if (-not $Raw) { $all += @('--output', 'json') }
  $all += '--no-cli-pager'

  $output = & aws @all 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($AllowFailure) { return $null }
    throw "aws $($Arguments -join ' ') failed: $($output | Out-String)"
  }
  $text = ($output | Out-String).Trim()
  if ($Raw) { return $text }
  if (-not $text -or $text -eq 'null') { return $null }
  return $text | ConvertFrom-Json
}

function Get-StackStatus {
  <# CloudFormation status of a stack, or null when it does not exist. #>
  param([Parameter(Mandatory)][string]$StackName)
  $result = Invoke-Aws -AllowFailure -Arguments @(
    'cloudformation', 'describe-stacks', '--stack-name', $StackName,
    '--query', 'Stacks[0].StackStatus'
  )
  if ($null -eq $result) { return $null }
  return [string]$result
}

function Get-StackOutputs {
  <# Outputs of a stack as a hashtable keyed by OutputKey, or null. #>
  param([Parameter(Mandatory)][string]$StackName)
  $result = Invoke-Aws -AllowFailure -Arguments @(
    'cloudformation', 'describe-stacks', '--stack-name', $StackName,
    '--query', 'Stacks[0].Outputs'
  )
  if ($null -eq $result) { return $null }
  $map = @{}
  foreach ($entry in $result) { $map[$entry.OutputKey] = $entry.OutputValue }
  return $map
}

# --- CDK ---------------------------------------------------------------------

function Get-CdkContext {
  <# The context block of memorysmith-infra/cdk.json. #>
  $path = Join-Path $Global:MsInfraDir 'cdk.json'
  if (-not (Test-Path $path)) { throw "cdk.json not found at $path" }
  return (Get-Content $path -Raw | ConvertFrom-Json).context
}

function ConvertTo-CdkContextArgs {
  <# Turns a hashtable of overrides into the repeated -c key=value form. #>
  param([hashtable]$Overrides)
  $contextArgs = @()
  if (-not $Overrides) { return $contextArgs }
  foreach ($key in $Overrides.Keys) {
    $value = $Overrides[$key]
    if ($null -eq $value -or "$value" -eq '') { continue }
    $contextArgs += @('-c', "$key=$value")
  }
  return $contextArgs
}

function Invoke-Cdk {
  <# Runs the CDK CLI pinned by the repository, from memorysmith-infra. #>
  param([Parameter(Mandatory)][string[]]$CdkArgs)
  Write-Detail "cdk $($CdkArgs -join ' ')"
  Push-Location $Global:MsInfraDir
  try {
    & pnpm exec cdk @CdkArgs
    if ($LASTEXITCODE -ne 0) { throw "cdk $($CdkArgs -join ' ') exited with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

function Invoke-Pnpm {
  param(
    [Parameter(Mandatory)][string[]]$PnpmArgs,
    [string]$WorkingDirectory = $Global:MsRepoRoot
  )
  Write-Detail "pnpm $($PnpmArgs -join ' ')"
  Push-Location $WorkingDirectory
  try {
    & pnpm @PnpmArgs
    if ($LASTEXITCODE -ne 0) { throw "pnpm $($PnpmArgs -join ' ') exited with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

# --- Preflight ---------------------------------------------------------------

function Test-Toolchain {
  <#
    Local toolchain only: no network, no credentials. Both deploy and destroy
    need it, because destroy also synthesizes the app before deleting it.
  #>
  $checks = @()

  $checks += New-Check -Name 'PowerShell' -Status 'ok' -Detail "$($PSVersionTable.PSVersion)"

  $node = Get-ToolVersion -Command 'node'
  if (-not $node) {
    $checks += New-Check -Name 'Node.js' -Status 'gap' -Detail 'not found on PATH' `
      -Fix 'winget install -e --id OpenJS.NodeJS.LTS (22 or newer)'
  } elseif ($node.Major -lt 22) {
    $checks += New-Check -Name 'Node.js' -Status 'gap' -Detail "v$node; the CDK app and the Lambda runtime need 22+" `
      -Fix 'winget install -e --id OpenJS.NodeJS.LTS'
  } else {
    $checks += New-Check -Name 'Node.js' -Status 'ok' -Detail "v$node"
  }

  $pnpm = Get-ToolVersion -Command 'pnpm'
  if (-not $pnpm) {
    $checks += New-Check -Name 'pnpm' -Status 'gap' -Detail 'not found on PATH' `
      -Fix 'npm install -g pnpm@11.22.0'
  } elseif ($pnpm.Major -lt 11) {
    $checks += New-Check -Name 'pnpm' -Status 'gap' -Detail "v$pnpm; the workspace needs 11+" `
      -Fix 'npm install -g pnpm@11.22.0'
  } else {
    $checks += New-Check -Name 'pnpm' -Status 'ok' -Detail "v$pnpm"
  }

  $hasRootModules = Test-Path (Join-Path $Global:MsRepoRoot 'node_modules')
  $hasCdkCli = Test-Path (Join-Path $Global:MsInfraDir 'node_modules' '.bin')
  $hasEsbuild = Test-Path (Join-Path $Global:MsInfraDir 'node_modules' 'esbuild')
  if ($hasRootModules -and $hasCdkCli -and $hasEsbuild) {
    $checks += New-Check -Name 'Workspace deps' -Status 'ok' -Detail 'installed, esbuild present'
  } else {
    $checks += New-Check -Name 'Workspace deps' -Status 'warn' -Detail 'node_modules missing or incomplete' `
      -Fix 'pnpm install (deploy.ps1 runs it unless -SkipInstall is given)'
  }

  if (Test-CommandExists 'git') {
    $checks += New-Check -Name 'git' -Status 'ok' -Detail 'available'
  } else {
    $checks += New-Check -Name 'git' -Status 'warn' -Detail 'not found; the deploy does not need it'
  }

  return $checks
}

function Test-AwsAccess {
  <#
    Credentials and region. Everything after this needs both to be sound, so a
    caller that gets a gap here must stop instead of guessing.
  #>
  $checks = @()

  if (-not (Test-CommandExists 'aws')) {
    $checks += New-Check -Name 'AWS CLI' -Status 'gap' -Detail 'not found on PATH' `
      -Fix 'winget install -e --id Amazon.AWSCLI, then reopen the terminal'
    return $checks
  }

  $awsVersion = Get-ToolVersion -Command 'aws'
  if ($awsVersion -and $awsVersion.Major -lt 2) {
    $checks += New-Check -Name 'AWS CLI' -Status 'warn' -Detail "v$awsVersion; v2 is what this project expects"
  } elseif ($awsVersion) {
    $checks += New-Check -Name 'AWS CLI' -Status 'ok' -Detail "v$awsVersion"
  } else {
    $checks += New-Check -Name 'AWS CLI' -Status 'ok' -Detail 'available'
  }

  $identity = Invoke-Aws -AllowFailure -Arguments @('sts', 'get-caller-identity')
  if (-not $identity) {
    # Naming the profiles that DO exist turns the most common cause of this gap
    # (credentials under a named profile, none under default) into a one-liner.
    $fix = 'aws configure, or aws sso login --profile <name> and then -Profile <name>'
    $profiles = @()
    try { $profiles = @(& aws configure list-profiles 2>$null) } catch { $profiles = @() }
    $profiles = @($profiles | Where-Object { $_ })
    if ($profiles.Count -gt 0) {
      $fix = "profiles on this machine: $($profiles -join ', '). Retry with -Profile <name>"
    }
    $where = if ($Global:MsAws.Profile) { "profile '$($Global:MsAws.Profile)'" } else { 'the default credential chain' }
    $checks += New-Check -Name 'AWS credentials' -Status 'gap' `
      -Detail "$where resolved nothing usable" -Fix $fix
  } else {
    $checks += New-Check -Name 'AWS credentials' -Status 'ok' `
      -Detail "account $($identity.Account) as $($identity.Arn)"
  }

  $checks += New-Check -Name 'Target region' -Status 'ok' -Detail $Global:MsAws.Region

  return $checks
}

function Test-DeployPreconditions {
  <#
    Everything the deploy needs beyond credentials: the CDK context, the hosted
    zone behind it, the DNS delegation the certificates wait on, the bootstrap
    stack, and the retained tables that would collide with a fresh deploy.
  #>
  param(
    [Parameter(Mandatory)][string]$ZoneName,
    [Parameter(Mandatory)][string]$ZoneId,
    [string]$CognitoDomainPrefix,
    [string]$TestUserEmail
  )
  $checks = @()

  # --- Context -------------------------------------------------------------
  if (-not $ZoneName) {
    $checks += New-Check -Name 'CDK context' -Status 'gap' -Detail 'hostedZoneName is empty' `
      -Fix 'set hostedZoneName in memorysmith-infra/cdk.json'
    return $checks
  }
  if (-not $ZoneId -or $ZoneId -like '*PLACEHOLDER*') {
    $checks += New-Check -Name 'CDK context' -Status 'gap' `
      -Detail "hostedZoneId is '$ZoneId', which is the placeholder" `
      -Fix 'aws route53 list-hosted-zones-by-name --dns-name <zone> and put the Z... id in cdk.json, or pass -HostedZoneId'
    return $checks
  }
  $contextDetail = "$ZoneName / $ZoneId"
  if ($CognitoDomainPrefix) { $contextDetail += " / $CognitoDomainPrefix" }
  $checks += New-Check -Name 'CDK context' -Status 'ok' -Detail $contextDetail

  if (-not $TestUserEmail) {
    $checks += New-Check -Name 'Test user' -Status 'warn' -Detail 'testUserEmail is empty; no test user will be seeded'
  } else {
    $checks += New-Check -Name 'Test user' -Status 'ok' -Detail $TestUserEmail
  }

  # --- Hosted zone ---------------------------------------------------------
  $zone = Invoke-Aws -AllowFailure -Arguments @('route53', 'get-hosted-zone', '--id', $ZoneId)
  if (-not $zone) {
    $checks += New-Check -Name 'Hosted zone' -Status 'gap' `
      -Detail "$ZoneId does not exist in this account" `
      -Fix 'create the public hosted zone in Route 53 and use its real id'
  } else {
    $actualName = "$($zone.HostedZone.Name)".TrimEnd('.')
    if ($actualName -ne $ZoneName) {
      $checks += New-Check -Name 'Hosted zone' -Status 'gap' `
        -Detail "$ZoneId answers for '$actualName', not '$ZoneName'" `
        -Fix 'point hostedZoneId at the zone of hostedZoneName'
    } else {
      $checks += New-Check -Name 'Hosted zone' -Status 'ok' -Detail "$actualName ($ZoneId)"
    }
  }

  # --- DNS delegation ------------------------------------------------------
  # ACM validates by DNS in this very zone: while the registrar still answers
  # with someone else's nameservers, the certificate never gets issued and the
  # network stack sits in CREATE_IN_PROGRESS until it times out.
  $delegation = Get-NameserverDelegation -ZoneName $ZoneName
  if ($null -eq $delegation) {
    $checks += New-Check -Name 'DNS delegation' -Status 'warn' `
      -Detail 'could not resolve the NS records; check it by hand before blaming the deploy' `
      -Fix "nslookup -type=NS $ZoneName 8.8.8.8"
  } elseif ($delegation -match 'awsdns') {
    $checks += New-Check -Name 'DNS delegation' -Status 'ok' -Detail 'the public NS records point at Route 53'
  } else {
    $checks += New-Check -Name 'DNS delegation' -Status 'gap' `
      -Detail "the public NS records still point at $delegation" `
      -Fix 'point the registrar at the four Route 53 nameservers; ACM validation waits on this'
  }

  # --- Bootstrap -----------------------------------------------------------
  $bootstrap = Get-StackStatus -StackName 'CDKToolkit'
  if (-not $bootstrap) {
    $checks += New-Check -Name 'CDK bootstrap' -Status 'warn' `
      -Detail "region $($Global:MsAws.Region) is not bootstrapped" `
      -Fix 'deploy.ps1 bootstraps it automatically unless -SkipBootstrap is given'
  } else {
    $checks += New-Check -Name 'CDK bootstrap' -Status 'ok' -Detail "CDKToolkit is $bootstrap"
  }

  # --- Orphan tables -------------------------------------------------------
  # mv-audit always retains on destroy, and every table has a fixed name, so a
  # leftover table makes a fresh deploy fail with AlreadyExists.
  $dataStack = Get-StackStatus -StackName 'MemorysmithData'
  if (-not $dataStack) {
    $tables = Invoke-Aws -AllowFailure -Arguments @('dynamodb', 'list-tables', '--query', 'TableNames')
    $orphans = @()
    if ($tables) {
      $orphans = @($Global:MsDataTables | Where-Object { $tables -contains $_ })
    }
    if ($orphans.Count -gt 0) {
      $checks += New-Check -Name 'Orphan tables' -Status 'gap' `
        -Detail "$($orphans -join ', ') exist without MemorysmithData; the deploy would fail with AlreadyExists" `
        -Fix "aws dynamodb delete-table --table-name <name> for each, or import them into the stack"
    } else {
      $checks += New-Check -Name 'Orphan tables' -Status 'ok' -Detail 'none left behind'
    }
  } else {
    $checks += New-Check -Name 'Data stack' -Status 'ok' -Detail "MemorysmithData is $dataStack"
  }

  # --- Cognito domain prefix ----------------------------------------------
  if ($CognitoDomainPrefix) {
    $identityStack = Get-StackStatus -StackName 'MemorysmithIdentity'
    if (-not $identityStack) {
      $domain = Invoke-Aws -AllowFailure -Arguments @(
        'cognito-idp', 'describe-user-pool-domain', '--domain', $CognitoDomainPrefix
      )
      if ($domain -and $domain.DomainDescription -and $domain.DomainDescription.UserPoolId) {
        $checks += New-Check -Name 'Cognito domain' -Status 'warn' `
          -Detail "prefix '$CognitoDomainPrefix' is already taken by user pool $($domain.DomainDescription.UserPoolId)" `
          -Fix 'choose another cognitoDomainPrefix, or reuse the stack that owns it'
      } else {
        $checks += New-Check -Name 'Cognito domain' -Status 'ok' -Detail "prefix '$CognitoDomainPrefix' looks free"
      }
    }
  }

  # --- Failed stacks -------------------------------------------------------
  # ROLLBACK_COMPLETE cannot be updated: CloudFormation only accepts a delete.
  $stuck = @()
  foreach ($stack in $Global:MsAllStacks) {
    $status = Get-StackStatus -StackName $stack
    if ($status -eq 'ROLLBACK_COMPLETE' -or $status -eq 'REVIEW_IN_PROGRESS') {
      $stuck += "$stack ($status)"
    }
  }
  if ($stuck.Count -gt 0) {
    $checks += New-Check -Name 'Stack states' -Status 'gap' `
      -Detail "$($stuck -join ', ') cannot be updated in that state" `
      -Fix 'destroy.ps1 -Stacks <name>, or delete the stack in the CloudFormation console, then deploy again'
  } else {
    $checks += New-Check -Name 'Stack states' -Status 'ok' -Detail 'no stack stuck in a non-updatable state'
  }

  return $checks
}

function Get-NameserverDelegation {
  <#
    The nameservers the public internet hands out for the zone, as a single
    string, or null when the lookup fails. Resolve-DnsName is Windows only, so
    nslookup is the fallback everywhere else.
  #>
  param([Parameter(Mandatory)][string]$ZoneName)
  if (Test-CommandExists 'Resolve-DnsName') {
    try {
      $records = Resolve-DnsName -Name $ZoneName -Type NS -Server '8.8.8.8' -ErrorAction Stop
      $servers = @($records | Where-Object { $_.QueryType -eq 'NS' } | ForEach-Object { $_.NameHost })
      if ($servers.Count -eq 0) { return $null }
      return ($servers -join ', ')
    } catch {
      return $null
    }
  }
  if (Test-CommandExists 'nslookup') {
    try {
      $raw = & nslookup -type=NS $ZoneName 8.8.8.8 2>&1 | Out-String
      $found = [regex]::Matches($raw, 'nameserver\s*=\s*([^\s]+)')
      if ($found.Count -eq 0) { return $null }
      return (($found | ForEach-Object { $_.Groups[1].Value.TrimEnd('.') }) -join ', ')
    } catch {
      return $null
    }
  }
  return $null
}

function Test-HttpExpectation {
  <#
    One post-deploy check: request a URL and compare the status code, and the
    body or a header when asked. Returns a check line, never throws.
  #>
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Url,
    [int]$ExpectedStatus = 200,
    [string]$BodyContains = '',
    [string]$HeaderContains = '',
    [string]$HeaderName = ''
  )
  try {
    $response = Invoke-WebRequest -Uri $Url -SkipHttpErrorCheck -MaximumRedirection 0 `
      -TimeoutSec 25 -ErrorAction Stop
  } catch {
    return New-Check -Name $Name -Status 'gap' -Detail "$Url is unreachable: $($_.Exception.Message)" `
      -Fix 'DNS may still be propagating; retry in a few minutes'
  }

  if ($response.StatusCode -ne $ExpectedStatus) {
    return New-Check -Name $Name -Status 'gap' `
      -Detail "$Url answered $($response.StatusCode), expected $ExpectedStatus"
  }
  if ($BodyContains -and "$($response.Content)" -notlike "*$BodyContains*") {
    return New-Check -Name $Name -Status 'gap' -Detail "$Url does not carry '$BodyContains'"
  }
  if ($HeaderName -and $HeaderContains) {
    $value = ''
    if ($response.Headers.ContainsKey($HeaderName)) { $value = ($response.Headers[$HeaderName] -join ' ') }
    if ($value -notlike "*$HeaderContains*") {
      return New-Check -Name $Name -Status 'gap' `
        -Detail "$Url header $HeaderName is '$value', expected it to carry '$HeaderContains'"
    }
  }
  return New-Check -Name $Name -Status 'ok' -Detail "$Url -> $($response.StatusCode)"
}

function Confirm-Action {
  <#
    A typed confirmation, not a y/n: the operator has to write the exact word,
    which is what keeps a destroy from happening by muscle memory.
  #>
  param(
    [Parameter(Mandatory)][string]$Prompt,
    [Parameter(Mandatory)][string]$Expected
  )
  Write-Host ''
  Write-Host $Prompt -ForegroundColor Yellow
  $answer = Read-Host "  type '$Expected' to continue"
  return ($answer -eq $Expected)
}
