#Requires -Version 7.0
<#
.SYNOPSIS
  Deploys the whole MemorySmith infrastructure to AWS with the CDK.

.DESCRIPTION
  One command for the entire environment: it checks the toolchain and the
  account, points at every gap it finds, installs the workspace, bootstraps the
  region when needed, synthesizes, deploys the six backend stacks, writes the
  frontend environment from the real stack outputs, builds the SPA, deploys the
  hosting stack and verifies the result over HTTP.

  Nothing here is meant to be run by hand step by step. If a step fails, fix
  what the report says and run the script again: every step is idempotent.

.PARAMETER Region
  Target region. Defaults to CDK_DEFAULT_REGION, then to the region of the AWS
  profile, then to us-east-1.

.PARAMETER ProfileName
  AWS profile to use. Defaults to the standard credential chain.

.PARAMETER HostedZoneId
  Overrides hostedZoneId from cdk.json for this run.

.PARAMETER CognitoDomainPrefix
  Overrides cognitoDomainPrefix from cdk.json for this run.

.PARAMETER Stacks
  Deploys only these stacks instead of all of them.

.PARAMETER EphemeralData
  Gives the data resources a DESTROY removal policy, so a sandbox can be torn
  down completely. Never use it on an environment whose data matters: the audit
  trail is retained either way, but nothing else is.

.PARAMETER PreflightOnly
  Runs the checks and stops, changing nothing.

.PARAMETER IgnoreGaps
  Runs even when the preflight found gaps. Last resort, for a check that is
  wrong about your environment rather than a precondition that is really missing.

.EXAMPLE
  ./deploy-aws/deploy.ps1
  Full deploy of every stack, with the frontend built against the real API.

.EXAMPLE
  ./deploy-aws/deploy.ps1 -PreflightOnly
  Only the environment report: what is in place, what is missing, how to fix it.

.EXAMPLE
  ./deploy-aws/deploy.ps1 -Stacks MemorysmithApi,MemorysmithAgent -SkipInstall
  Redeploys two stacks after a backend change.
#>

[CmdletBinding()]
param(
  [string]$Region,
  [Alias('Profile')][string]$ProfileName,
  [string]$HostedZoneId,
  [string]$CognitoDomainPrefix,
  [string[]]$Stacks,
  [switch]$EphemeralData,
  [switch]$SkipInstall,
  [switch]$SkipSynth,
  [switch]$SkipBootstrap,
  [switch]$SkipFrontend,
  [switch]$SkipVerify,
  [switch]$KeepFrontendEnv,
  [switch]$PreflightOnly,
  [switch]$IgnoreGaps
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib' 'common.ps1')

$started = Get-Date

Write-Host ''
Write-Host 'MemorySmith - deploy to AWS' -ForegroundColor White

# --- 1. Context --------------------------------------------------------------

Set-AwsContext -Region $Region -ProfileName $ProfileName

$context = Get-CdkContext
$zoneName = $context.hostedZoneName
$zoneId = if ($HostedZoneId) { $HostedZoneId } else { $context.hostedZoneId }
$domainPrefix = if ($CognitoDomainPrefix) { $CognitoDomainPrefix } else { $context.cognitoDomainPrefix }

$contextOverrides = @{
  hostedZoneId        = $HostedZoneId
  cognitoDomainPrefix = $CognitoDomainPrefix
}
if ($EphemeralData) { $contextOverrides['retainData'] = 'false' }
$contextArgs = ConvertTo-CdkContextArgs -Overrides $contextOverrides

# --- 2. Preflight ------------------------------------------------------------

Write-Step 'Preflight: toolchain'
$toolchainGaps = Write-CheckReport -Checks (Test-Toolchain)

Write-Step 'Preflight: AWS account'
$awsChecks = Test-AwsAccess
$awsGaps = Write-CheckReport -Checks $awsChecks

$environmentGaps = 0
if ($awsGaps -eq 0) {
  Write-Step 'Preflight: environment'
  $environmentGaps = Write-CheckReport -Checks (Test-DeployPreconditions `
      -ZoneName $zoneName -ZoneId $zoneId `
      -CognitoDomainPrefix $domainPrefix)
} else {
  Write-Warn 'skipping the environment checks: they all need working credentials'
}

$totalGaps = $toolchainGaps + $awsGaps + $environmentGaps
if ($totalGaps -gt 0 -and -not $IgnoreGaps) {
  Write-Host ''
  Write-Gap "$totalGaps gap(s) block this deploy. Fix them and run the script again."
  Write-Detail 'or, if a check is wrong about your environment, run with -IgnoreGaps'
  exit 1
}
if ($totalGaps -gt 0) {
  Write-Warn "continuing with $totalGaps unresolved gap(s) because -IgnoreGaps was given"
}

if ($PreflightOnly) {
  Write-Host ''
  Write-Ok 'Preflight only: nothing was deployed.'
  exit 0
}

# --- 3. Workspace ------------------------------------------------------------

if (-not $SkipInstall) {
  Write-Step 'Installing the workspace'
  Invoke-Pnpm -PnpmArgs @('install', '--frozen-lockfile')
} else {
  Write-Step 'Skipping the install (-SkipInstall)'
}

# --- 4. Bootstrap ------------------------------------------------------------

if (-not $SkipBootstrap) {
  if (-not (Get-StackStatus -StackName 'CDKToolkit')) {
    Write-Step "Bootstrapping $($Global:MsAws.Region)"
    Invoke-Cdk -CdkArgs (@('bootstrap') + $contextArgs)
  } else {
    Write-Step 'Bootstrap already in place'
  }
}

# --- 5. Synth ----------------------------------------------------------------

if (-not $SkipSynth) {
  Write-Step 'Synthesizing the app'
  Invoke-Cdk -CdkArgs (@('synth', '--quiet') + $contextArgs)
  Write-Ok 'synth is clean'
}

# --- 6. Backend stacks -------------------------------------------------------

$requested = if ($Stacks) { $Stacks } else { $Global:MsAllStacks }
foreach ($stack in $requested) {
  if ($Global:MsAllStacks -notcontains $stack) {
    throw "Unknown stack '$stack'. Known stacks: $($Global:MsAllStacks -join ', ')"
  }
}
$backendTargets = @($requested | Where-Object { $_ -ne $Global:MsFrontendStack })
$deployFrontend = (-not $SkipFrontend) -and ($requested -contains $Global:MsFrontendStack)

# The sign-in page answers at a custom domain, and Cognito only accepts one
# whose PARENT already resolves an A record. That record belongs to the hosting
# stack, so on an environment where nothing is up yet the order inverts: the
# distribution goes up first, empty, and the SPA is published into it at the end
# of this script, once the API it talks to exists. The hosting stack skips its
# upload while memorysmith-frontend/dist is absent, so this first pass costs
# nothing but the DNS record and the distribution.

if (($backendTargets -contains 'MemorysmithIdentity') -and -not (Get-StackStatus -StackName 'MemorysmithIdentity')) {
  if (Get-ApexAddress -ZoneName $zoneName) {
    Write-Detail "$zoneName already resolves; the sign-in domain can be created in order"
  } else {
    Write-Step "Creating $zoneName before the sign-in domain"
    Write-Detail 'Cognito rejects a custom domain whose parent resolves no A record'
    Invoke-Cdk -CdkArgs (@('deploy', $Global:MsFrontendStack, '--require-approval', 'never') + $contextArgs)
    $apexAddress = Wait-ApexAddress -ZoneName $zoneName
    if (-not $apexAddress) {
      throw "$zoneName still resolves no A record. The hosting stack is up, so this is DNS propagation: wait a few minutes and run the script again."
    }
    Write-Ok "$zoneName resolves to $apexAddress"
  }
}

if ($backendTargets.Count -gt 0) {
  Write-Step "Deploying the backend: $($backendTargets -join ', ')"
  Write-Detail 'first run: the ACM certificates validate by DNS and take a few minutes'
  Invoke-Cdk -CdkArgs (@('deploy') + $backendTargets + @('--require-approval', 'never') + $contextArgs)
  Write-Ok 'backend stacks are up'
}

# --- 7. Frontend -------------------------------------------------------------
# The hosting stack only uploads files that already exist, so the SPA has to be
# built BEFORE it is deployed, and it has to be built against the real API. That
# ordering is the reason the frontend is not simply part of --all.

if ($deployFrontend) {
  $identity = Get-StackOutputs -StackName 'MemorysmithIdentity'
  if (-not $identity) {
    throw 'MemorysmithIdentity has no outputs yet; deploy the backend before the frontend.'
  }

  $envPath = Join-Path $Global:MsFrontendDir '.env.local'
  if ($KeepFrontendEnv -and (Test-Path $envPath)) {
    Write-Step 'Keeping the existing memorysmith-frontend/.env.local'
  } else {
    Write-Step 'Writing memorysmith-frontend/.env.local from the stack outputs'
    $envContent = @(
      "VITE_API_ORIGIN=https://api.$zoneName",
      "VITE_COGNITO_DOMAIN=$($identity['CognitoDomain'])",
      "VITE_COGNITO_CLIENT_ID=$($identity['WebClientId'])",
      ''
    ) -join "`n"
    Set-Content -Path $envPath -Value $envContent -Encoding utf8NoBOM -NoNewline
    Write-Ok "api https://api.$zoneName, client $($identity['WebClientId'])"
  }

  Write-Step 'Building the SPA'
  Invoke-Pnpm -PnpmArgs @('-C', 'memorysmith-frontend', 'build')

  Write-Step "Deploying $($Global:MsFrontendStack)"
  Invoke-Cdk -CdkArgs (@('deploy', $Global:MsFrontendStack, '--require-approval', 'never') + $contextArgs)
  Write-Ok 'the SPA is published'
} elseif ($SkipFrontend) {
  Write-Step 'Skipping the frontend (-SkipFrontend)'
}

# --- 8. Log retention --------------------------------------------------------
# `ServiceLambda` declares the log group of every function this project writes,
# so those already expire. The custom resources the CDK creates on its own do
# not accept a log group: the Lambda service creates theirs on first invocation,
# without retention, and those events would be billed forever. Setting the
# policy here is idempotent and has no race with the deploy that just ran.

Write-Step 'Log retention'
$retentionChecks = Set-OrphanLogRetention -RetentionInDays 30
Write-CheckReport -Checks $retentionChecks | Out-Null

# --- 9. Verify ---------------------------------------------------------------

$verifyGaps = 0
if (-not $SkipVerify) {
  Write-Step 'Verifying what is on the air'
  $verifications = @()

  if ($backendTargets -contains 'MemorysmithApi') {
    $verifications += Test-HttpExpectation -Name 'api health' -Url "https://api.$zoneName/health" -BodyContains 'ok'
  }
  if ($backendTargets -contains 'MemorysmithAgent') {
    # An unauthenticated MCP request must answer 401 AND point at its metadata
    # document: that header is what makes an agent client discover the
    # authorization server instead of giving up.
    $verifications += Test-HttpExpectation -Name 'mcp challenge' -Url "https://mcp.$zoneName/mcp" `
      -ExpectedStatus 401 -HeaderName 'WWW-Authenticate' -HeaderContains 'resource_metadata'
    $verifications += Test-HttpExpectation -Name 'mcp resource doc' `
      -Url "https://mcp.$zoneName/.well-known/oauth-protected-resource" -BodyContains 'authorization_servers'
    $verifications += Test-HttpExpectation -Name 'mcp auth server doc' `
      -Url "https://mcp.$zoneName/.well-known/oauth-authorization-server" `
      -BodyContains 'client_id_metadata_document_supported'
  }
  if ($deployFrontend) {
    $verifications += Test-HttpExpectation -Name 'site' -Url "https://$zoneName/"
  }

  if ($verifications.Count -gt 0) {
    $verifyGaps = Write-CheckReport -Checks $verifications
  } else {
    Write-Detail 'nothing to verify for the stacks that were deployed'
  }
}

# --- 10. Summary -------------------------------------------------------------

Write-Step 'Environment'
$identityOutputs = Get-StackOutputs -StackName 'MemorysmithIdentity'
$agentOutputs = Get-StackOutputs -StackName 'MemorysmithAgent'

Write-Host "  account          $((Invoke-Aws -AllowFailure -Arguments @('sts','get-caller-identity')).Account)"
Write-Host "  region           $($Global:MsAws.Region)"
Write-Host "  site             https://$zoneName"
Write-Host "  api              https://api.$zoneName"
if ($agentOutputs) { Write-Host "  mcp              $($agentOutputs['McpEndpoint'])" }
if ($identityOutputs) {
  Write-Host "  user pool        $($identityOutputs['UserPoolId'])"
  Write-Host "  spa client       $($identityOutputs['WebClientId'])"
  Write-Host "  cognito domain   $($identityOutputs['CognitoDomain'])"
}

$elapsed = (Get-Date) - $started
Write-Host ''
if ($verifyGaps -gt 0) {
  Write-Warn ("deploy finished in {0:mm\:ss} with {1} failing verification(s)" -f $elapsed, $verifyGaps)
  exit 1
}
Write-Ok ("deploy finished in {0:mm\:ss}" -f $elapsed)
Write-Detail 'next: ./deploy-aws/onboard.ps1 creates the first account, its subscription and its vault'
# Explicit, so the exit code is the script's and not that of the last native
# command that happened to run inside it.
exit 0
