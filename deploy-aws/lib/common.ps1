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

function Get-CdkAssemblyArgs {
  <#
    Points the CDK at the cloud assembly already on disk, when there is one.

    Synthesizing this app bundles six Lambda functions with esbuild and costs
    minutes on a cold cache. A DELETE needs none of that: CloudFormation deletes
    by stack name and never looks at the local template. Reusing the assembly
    turns those minutes into nothing, and minutes are what push a tear down past
    the time limit of whatever is running it.

    Only ever right for a destroy. A deploy must synthesize.
  #>
  if (Test-Path (Join-Path $Global:MsInfraDir 'cdk.out' 'manifest.json')) {
    return @('--app', 'cdk.out')
  }
  return @()
}

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

function Wait-StackSettled {
  <#
    Waits while a stack is in the middle of an operation someone else started.

    This matters because CloudFormation keeps working after the CDK process is
    gone: killing the CLI does not cancel a delete. Deleting a Cognito user pool
    DOMAIN in particular tears down a CloudFront distribution behind the scenes
    and can take the better part of an hour on its own, so a second run has to
    join the operation already running instead of firing another one at it.

    Returns the final status, or null when the stack no longer exists.
  #>
  param(
    [Parameter(Mandatory)][string]$StackName,
    [int]$TimeoutMinutes = 90,
    [int]$PollSeconds = 20
  )
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $announced = $false
  while ($true) {
    $status = Get-StackStatus -StackName $StackName
    if (-not $status -or $status -notlike '*_IN_PROGRESS') {
      if ($announced) { Write-Ok "$StackName settled as $(if ($status) { $status } else { 'deleted' })" }
      return $status
    }
    if (-not $announced) {
      Write-Warn "$StackName is $status; waiting for it to finish before doing anything"
      Write-Detail 'a Cognito domain delete tears down a CloudFront distribution and is slow by nature'
      $announced = $true
    }
    if ((Get-Date) -gt $deadline) {
      throw "$StackName is still $status after $TimeoutMinutes minutes; check its events in the console"
    }
    Start-Sleep -Seconds $PollSeconds
  }
}

function Remove-BucketCompletely {
  <#
    Empties a versioned bucket and deletes it. `aws s3 rm --recursive` is not
    enough here: it removes current objects and leaves every old version and
    delete marker behind, and a bucket that still holds versions cannot be
    deleted.
  #>
  param([Parameter(Mandatory)][string]$BucketName)

  while ($true) {
    $listing = Invoke-Aws -AllowFailure -Arguments @(
      's3api', 'list-object-versions', '--bucket', $BucketName, '--max-keys', '1000',
      '--query', '{v: Versions[].{Key:Key,VersionId:VersionId}, m: DeleteMarkers[].{Key:Key,VersionId:VersionId}}'
    )
    if (-not $listing) { break }
    $objects = @()
    if ($listing.v) { $objects += @($listing.v) }
    if ($listing.m) { $objects += @($listing.m) }
    if ($objects.Count -eq 0) { break }

    $payloadFile = [System.IO.Path]::GetTempFileName()
    try {
      $payload = @{ Objects = @($objects | ForEach-Object { @{ Key = $_.Key; VersionId = $_.VersionId } }); Quiet = $true }
      Set-Content -Path $payloadFile -Value ($payload | ConvertTo-Json -Depth 5 -Compress) -Encoding utf8NoBOM
      $deleted = Invoke-Aws -AllowFailure -Arguments @(
        's3api', 'delete-objects', '--bucket', $BucketName, '--delete', "file://$payloadFile"
      )
      if ($null -eq $deleted -and $objects.Count -gt 0) {
        # delete-objects answers with an empty body in quiet mode, so a null
        # result is normal; only a listing that never shrinks means trouble.
      }
      Write-Detail "$BucketName : removed $($objects.Count) version(s)"
    } finally {
      Remove-Item $payloadFile -ErrorAction SilentlyContinue
    }
  }

  $result = Invoke-Aws -AllowFailure -Raw -Arguments @('s3api', 'delete-bucket', '--bucket', $BucketName)
  return ($null -ne $result)
}

function Remove-RetainedResources {
  <#
    The administrative half of a purge.

    Stacks retain what they must not lose by accident: the audit table, the user
    pool with its globally unique domain prefix, and any bucket a failed delete
    left behind. None of that goes away with `cdk destroy`, and all of it blocks
    the next deploy. Deleting it is a deliberate act with its own switch, which
    is exactly why it lives here and not in a removal policy.

    Returns the check lines describing what was removed.
  #>
  $checks = @()

  # --- Tables, audit trail included ---------------------------------------
  $tableNames = Invoke-Aws -AllowFailure -Arguments @('dynamodb', 'list-tables', '--query', 'TableNames')
  $remaining = @()
  if ($tableNames) { $remaining = @($Global:MsDataTables | Where-Object { $tableNames -contains $_ }) }
  foreach ($table in $remaining) {
    $done = Invoke-Aws -AllowFailure -Arguments @('dynamodb', 'delete-table', '--table-name', $table)
    if ($done) {
      $checks += New-Check -Name "table $table" -Status 'ok' -Detail 'deleted'
    } else {
      $checks += New-Check -Name "table $table" -Status 'gap' -Detail 'could not be deleted' `
        -Fix "aws dynamodb delete-table --table-name $table"
    }
  }
  if ($remaining.Count -eq 0) {
    $checks += New-Check -Name 'tables' -Status 'ok' -Detail 'none left to delete'
  }

  # --- User pool and its domain -------------------------------------------
  # The domain has to go first: the prefix is unique across the region, and a
  # pool that still owns one cannot be deleted.
  $pools = Invoke-Aws -AllowFailure -Arguments @(
    'cognito-idp', 'list-user-pools', '--max-results', '60',
    '--query', "UserPools[?Name=='memorysmith-users'].Id"
  )
  foreach ($poolId in @($pools)) {
    if (-not $poolId) { continue }
    $described = Invoke-Aws -AllowFailure -Arguments @('cognito-idp', 'describe-user-pool', '--user-pool-id', $poolId)
    $prefix = $null
    if ($described -and $described.UserPool) {
      $prefix = $described.UserPool.Domain
      if (-not $prefix) { $prefix = $described.UserPool.CustomDomain }
    }
    if ($prefix) {
      Invoke-Aws -AllowFailure -Arguments @(
        'cognito-idp', 'delete-user-pool-domain', '--user-pool-id', $poolId, '--domain', $prefix
      ) | Out-Null
      $checks += New-Check -Name "domain $prefix" -Status 'ok' -Detail 'delete requested'
    }
    $done = Invoke-Aws -AllowFailure -Raw -Arguments @('cognito-idp', 'delete-user-pool', '--user-pool-id', $poolId)
    if ($null -ne $done) {
      $checks += New-Check -Name "user pool $poolId" -Status 'ok' -Detail 'deleted'
    } else {
      # A domain delete is asynchronous, and the pool refuses to go while it is
      # still attached. Saying so beats pretending the account is clean.
      $checks += New-Check -Name "user pool $poolId" -Status 'gap' `
        -Detail 'could not be deleted, most likely while its domain is still going away' `
        -Fix "aws cognito-idp delete-user-pool --user-pool-id $poolId, again in a few minutes"
    }
  }
  if (@($pools).Count -eq 0) {
    $checks += New-Check -Name 'user pool' -Status 'ok' -Detail 'none left to delete'
  }

  # --- Buckets a failed delete left behind --------------------------------
  $buckets = Invoke-Aws -AllowFailure -Arguments @(
    's3api', 'list-buckets', '--query', "Buckets[?starts_with(Name, 'memorysmith')].Name"
  )
  foreach ($bucket in @($buckets)) {
    if (-not $bucket) { continue }
    if (Remove-BucketCompletely -BucketName $bucket) {
      $checks += New-Check -Name "bucket $bucket" -Status 'ok' -Detail 'emptied and deleted'
    } else {
      $checks += New-Check -Name "bucket $bucket" -Status 'gap' -Detail 'could not be deleted' `
        -Fix "aws s3 rb s3://$bucket --force"
    }
  }
  if (@($buckets).Count -eq 0) {
    $checks += New-Check -Name 'buckets' -Status 'ok' -Detail 'none left to delete'
  }

  return $checks
}

# --- CloudWatch Logs ---------------------------------------------------------

function Get-MemorysmithLogGroups {
  <#
    Every log group this project owns, as objects with Name, Retention and
    Orphan. A group is orphan when it is a `/aws/lambda/<name>` group whose
    function no longer exists: the Lambda service, not CloudFormation, created
    it, so `cdk destroy` walked away and left it behind.
  #>
  $groups = Invoke-Aws -AllowFailure -Arguments @(
    'logs', 'describe-log-groups',
    '--query', "logGroups[?starts_with(logGroupName, '/aws/lambda/Memorysmith') || starts_with(logGroupName, 'Memorysmith')].{Name:logGroupName,Retention:retentionInDays,Bytes:storedBytes}"
  )
  if ($null -eq $groups) { return @() }

  $functions = Invoke-Aws -AllowFailure -Arguments @(
    'lambda', 'list-functions', '--query', 'Functions[].FunctionName'
  )
  $alive = @($functions)

  return @($groups | ForEach-Object {
      $orphan = $false
      if ($_.Name.StartsWith('/aws/lambda/')) {
        $orphan = -not ($alive -contains $_.Name.Substring('/aws/lambda/'.Length))
      }
      [pscustomobject]@{
        Name      = $_.Name
        Retention = $_.Retention
        Bytes     = $_.Bytes
        Orphan    = $orphan
      }
    })
}

function Set-OrphanLogRetention {
  <#
    Gives a retention to every log group that has none.

    `ServiceLambda` declares the log group of every function this project
    writes, so those are already covered. The gap is the custom resources the
    CDK creates on its own (`BucketDeployment`, `autoDeleteObjects`, the
    `AwsCustomResource` behind a Cognito custom domain): none of them accepts a
    log group, the Lambda service creates theirs on first invocation, and a
    group created that way keeps its events forever.

    Declaring those groups in the CDK is not the fix. Their function name is
    only known at deploy time, so the group can only be created after the
    function, and the custom resource is invoked in that same window: whoever
    gets there first wins, and when the Lambda service wins the stack fails
    with AlreadyExists. Setting the policy after the deploy has no such race
    and is idempotent.
  #>
  param([int]$RetentionInDays = 30)

  $checks = @()
  $missing = @(Get-MemorysmithLogGroups | Where-Object { $null -eq $_.Retention })

  if ($missing.Count -eq 0) {
    return @(New-Check -Name 'log retention' -Status 'ok' -Detail 'every log group already expires')
  }

  foreach ($group in $missing) {
    $result = Invoke-Aws -AllowFailure -Raw -Arguments @(
      'logs', 'put-retention-policy',
      '--log-group-name', $group.Name,
      '--retention-in-days', "$RetentionInDays"
    )
    if ($null -ne $result) {
      $checks += New-Check -Name 'log retention' -Status 'ok' `
        -Detail "$($group.Name) set to $RetentionInDays days"
    } else {
      $checks += New-Check -Name 'log retention' -Status 'warn' `
        -Detail "$($group.Name) could not be set" `
        -Fix "aws logs put-retention-policy --log-group-name $($group.Name) --retention-in-days $RetentionInDays"
    }
  }
  return $checks
}

function Remove-OrphanLogGroups {
  <#
    Deletes the log groups whose function is gone. Part of the administrative
    purge, never of a plain destroy: a log group is the only trace a function
    leaves once its stack is gone.
  #>
  $checks = @()
  $orphans = @(Get-MemorysmithLogGroups | Where-Object { $_.Orphan })

  if ($orphans.Count -eq 0) {
    return @(New-Check -Name 'log groups' -Status 'ok' -Detail 'none left behind')
  }

  foreach ($group in $orphans) {
    $result = Invoke-Aws -AllowFailure -Raw -Arguments @(
      'logs', 'delete-log-group', '--log-group-name', $group.Name
    )
    if ($null -ne $result) {
      $checks += New-Check -Name "log group $($group.Name)" -Status 'ok' -Detail 'deleted'
    } else {
      $checks += New-Check -Name "log group $($group.Name)" -Status 'warn' -Detail 'could not be deleted' `
        -Fix "aws logs delete-log-group --log-group-name $($group.Name)"
    }
  }
  return $checks
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
    [string]$CognitoDomainPrefix
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

  # --- Apex A record -------------------------------------------------------
  # Cognito refuses a custom domain whose parent name resolves no A record, and
  # the apex of this zone only gets one from the hosting stack. On an account
  # where nothing is up yet that inverts the usual order, and deploy.ps1 puts
  # hosting before identity by itself.
  $apex = Get-ApexAddress -ZoneName $ZoneName
  if ($apex) {
    $checks += New-Check -Name 'Apex A record' -Status 'ok' -Detail "$ZoneName resolves to $apex"
  } else {
    $checks += New-Check -Name 'Apex A record' -Status 'warn' `
      -Detail "$ZoneName resolves no A record, and Cognito rejects auth.$ZoneName while that is true" `
      -Fix 'deploy.ps1 deploys the hosting stack first to create it; nothing to do by hand'
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
  $busy = @()
  foreach ($stack in $Global:MsAllStacks) {
    $status = Get-StackStatus -StackName $stack
    if ($status -eq 'ROLLBACK_COMPLETE' -or $status -eq 'REVIEW_IN_PROGRESS') {
      $stuck += "$stack ($status)"
    } elseif ($status -like '*_IN_PROGRESS') {
      # A stack mid-operation refuses a second one, and a delete keeps running
      # long after the process that started it was killed.
      $busy += "$stack ($status)"
    }
  }
  if ($stuck.Count -gt 0) {
    $checks += New-Check -Name 'Stack states' -Status 'gap' `
      -Detail "$($stuck -join ', ') cannot be updated in that state" `
      -Fix 'destroy.ps1 -Stacks <name>, or delete the stack in the CloudFormation console, then deploy again'
  } elseif ($busy.Count -gt 0) {
    $checks += New-Check -Name 'Stack states' -Status 'gap' `
      -Detail "$($busy -join ', ') is in the middle of an operation" `
      -Fix 'wait for it to settle and deploy again; a Cognito domain delete alone can take the better part of an hour'
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

function Get-ApexAddress {
  <#
    The addresses the public internet hands out for a name, as a single string,
    or null when it resolves none. Cognito reads this same answer before it
    accepts a custom domain: a parent domain with no A record is rejected with
    "Custom domain is not a valid subdomain".
  #>
  param([Parameter(Mandatory)][string]$ZoneName)
  if (Test-CommandExists 'Resolve-DnsName') {
    try {
      $records = Resolve-DnsName -Name $ZoneName -Type A -Server '8.8.8.8' -ErrorAction Stop
      $addresses = @($records | Where-Object { $_.QueryType -eq 'A' } | ForEach-Object { $_.IPAddress })
      if ($addresses.Count -eq 0) { return $null }
      return ($addresses -join ', ')
    } catch {
      return $null
    }
  }
  if (Test-CommandExists 'nslookup') {
    try {
      $raw = & nslookup -type=A $ZoneName 8.8.8.8 2>&1 | Out-String
      # The answer section repeats the name, so only addresses that come after
      # it count: the first block is the resolver's own address.
      $answer = ($raw -split [regex]::Escape($ZoneName), 2)[1]
      if (-not $answer) { return $null }
      $found = [regex]::Matches($answer, '(\d{1,3}\.){3}\d{1,3}')
      if ($found.Count -eq 0) { return $null }
      return (($found | ForEach-Object { $_.Value }) -join ', ')
    } catch {
      return $null
    }
  }
  return $null
}

function Wait-ApexAddress {
  <#
    Waits until the apex resolves an A record publicly. Route 53 answers within
    seconds of the record being written, but a resolver that already cached the
    absence of the name keeps saying so until that negative answer expires, so
    this polls instead of asking once. Returns the addresses, or null on
    timeout.
  #>
  param(
    [Parameter(Mandatory)][string]$ZoneName,
    [int]$TimeoutSeconds = 300,
    [int]$IntervalSeconds = 15
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $address = Get-ApexAddress -ZoneName $ZoneName
    if ($address) { return $address }
    Write-Detail "$ZoneName still does not resolve; waiting for the record to propagate"
    Start-Sleep -Seconds $IntervalSeconds
  } while ((Get-Date) -lt $deadline)
  return (Get-ApexAddress -ZoneName $ZoneName)
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
