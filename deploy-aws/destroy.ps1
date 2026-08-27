#Requires -Version 7.0
<#
.SYNOPSIS
  Tears the MemorySmith infrastructure down from AWS.

.DESCRIPTION
  Checks the environment, lists what really exists in the account, states what
  will survive the deletion, asks for a typed confirmation and then runs
  `cdk destroy`. Afterwards it reports every resource still standing, because a
  retained table with a fixed name is exactly what breaks the next deploy.

  By design the tear down does NOT destroy data. The four tables and the
  content bucket are created with a RETAIN policy, so they outlive the stack,
  and so does the Cognito user pool. -PurgeData leaves nothing behind: it flips
  the removal policy of the data stack, destroys everything, and then deletes by
  hand what no removal policy would ever delete, the audit trail and the user
  pool with its domain prefix included.

  A tear down of this app can run for a long time, because deleting the Cognito
  domain tears down a CloudFront distribution behind the scenes. Killing the
  script does NOT cancel that: CloudFormation carries on, and running the script
  again joins the operation already in flight instead of firing another one.

.PARAMETER Region
  Target region. Defaults to CDK_DEFAULT_REGION, then to the region of the AWS
  profile, then to us-east-1.

.PARAMETER ProfileName
  AWS profile to use. Defaults to the standard credential chain.

.PARAMETER Stacks
  Destroys only these stacks instead of all of them.

.PARAMETER PurgeData
  Leaves nothing of the environment: the tables (audit trail included), the
  content bucket, and the Cognito user pool with its domain prefix.
  Irreversible, and only ever right for a sandbox.

.PARAMETER Force
  Skips the typed confirmation. For unattended runs only.

.PARAMETER PreflightOnly
  Runs the checks, lists what exists and what would survive, and stops before
  deleting anything.

.EXAMPLE
  ./deploy-aws/destroy.ps1
  Destroys the seven stacks and keeps the data behind.

.EXAMPLE
  ./deploy-aws/destroy.ps1 -PurgeData
  Sandbox tear down: nothing of this environment is left in the account.

.EXAMPLE
  ./deploy-aws/destroy.ps1 -Stacks MemorysmithFrontend
  Removes only the hosting stack.
#>

[CmdletBinding()]
param(
  [string]$Region,
  [Alias('Profile')][string]$ProfileName,
  [string[]]$Stacks,
  [switch]$PurgeData,
  [switch]$Force,
  [switch]$PreflightOnly,
  [switch]$IgnoreGaps
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib' 'common.ps1')

$started = Get-Date

Write-Host ''
Write-Host 'MemorySmith - destroy on AWS' -ForegroundColor White

# --- 1. Context --------------------------------------------------------------

Set-AwsContext -Region $Region -ProfileName $ProfileName

$context = Get-CdkContext
$zoneName = $context.hostedZoneName

# --- 2. Preflight ------------------------------------------------------------
# The destroy synthesizes the app before deleting anything, so it needs the same
# toolchain a deploy needs.

Write-Step 'Preflight: toolchain'
$toolchainGaps = Write-CheckReport -Checks (Test-Toolchain)

Write-Step 'Preflight: AWS account'
$awsGaps = Write-CheckReport -Checks (Test-AwsAccess)

$totalGaps = $toolchainGaps + $awsGaps
if ($totalGaps -gt 0 -and -not $IgnoreGaps) {
  Write-Host ''
  Write-Gap "$totalGaps gap(s) block this tear down. Fix them and run the script again."
  exit 1
}

# --- 3. What exists ----------------------------------------------------------

$requested = if ($Stacks) { $Stacks } else { $Global:MsAllStacks }
foreach ($stack in $requested) {
  if ($Global:MsAllStacks -notcontains $stack) {
    throw "Unknown stack '$stack'. Known stacks: $($Global:MsAllStacks -join ', ')"
  }
}

Write-Step 'Stacks in the account'
$existing = @()
foreach ($stack in $requested) {
  $status = Get-StackStatus -StackName $stack
  if ($status) {
    $existing += $stack
    Write-Ok ('{0,-24} {1}' -f $stack, $status)
  } else {
    Write-Detail ('{0,-24} not deployed' -f $stack)
  }
}

if ($existing.Count -eq 0) {
  Write-Host ''
  Write-Ok 'nothing to destroy.'
  exit 0
}

# --- 4. What survives --------------------------------------------------------

Write-Step 'What survives this tear down'
if ($PurgeData) {
  Write-Warn 'PurgeData: NOTHING of this environment survives'
  Write-Detail "tables $($Global:MsDataTables -join ', ') go, the audit trail included"
  Write-Detail 'the content bucket goes, with every note version'
  Write-Detail 'the Cognito user pool memorysmith-users goes, with its users and its domain prefix'
} else {
  Write-Detail "tables $($Global:MsDataTables -join ', ') retain, with their data"
  Write-Detail 'the content bucket retains, with every note version'
  Write-Detail 'the Cognito user pool memorysmith-users retains, with its users and its domain prefix'
  Write-Detail 'a retained table blocks the next deploy, because table names are fixed'
}
Write-Detail 'the Route 53 hosted zone is never touched: it was not created here'

# --- 5. Confirmation ---------------------------------------------------------

if ($PreflightOnly) {
  Write-Host ''
  Write-Ok 'Preflight only: nothing was destroyed.'
  exit 0
}

if (-not $Force) {
  $identity = Invoke-Aws -AllowFailure -Arguments @('sts', 'get-caller-identity')
  $account = if ($identity) { $identity.Account } else { 'unknown' }
  $prompt = "About to destroy $($existing.Count) stack(s) in account $account, region $($Global:MsAws.Region)."
  if (-not (Confirm-Action -Prompt $prompt -Expected $zoneName)) {
    Write-Host ''
    Write-Warn 'cancelled; nothing was destroyed.'
    exit 1
  }
}

# --- 6. Join whatever is already running -------------------------------------
# CloudFormation does not stop when the CDK process does: a killed run leaves
# its deletes going. Firing a second delete at a stack mid-delete only produces
# noise, so this joins the operation instead of racing it.

$inFlight = @($existing | Where-Object { (Get-StackStatus -StackName $_) -like '*_IN_PROGRESS' })
if ($inFlight.Count -gt 0) {
  Write-Step "Waiting for operations already running: $($inFlight -join ', ')"
  foreach ($stack in $inFlight) { Wait-StackSettled -StackName $stack | Out-Null }
  $existing = @($existing | Where-Object { Get-StackStatus -StackName $_ })
  if ($existing.Count -eq 0) {
    Write-Ok 'the run that was already going finished the job'
  }
}

# --- 7. Purge data -----------------------------------------------------------
# The removal policy that counts is the one in the DEPLOYED template, so making
# the data destroyable takes an update before the delete.

if ($PurgeData -and ($existing -contains 'MemorysmithData')) {
  Write-Step 'Flipping the data stack to a destroyable removal policy'
  Invoke-Cdk -CdkArgs @('deploy', 'MemorysmithData', '--require-approval', 'never', '-c', 'retainData=false')
  Write-Ok 'data resources now carry DESTROY'
}

# --- 8. Destroy --------------------------------------------------------------
# The delete reuses the assembly on disk instead of synthesizing again: a delete
# is by stack name, and CloudFormation never reads the local template.

if ($existing.Count -gt 0) {
  Write-Step "Destroying: $($existing -join ', ')"
  Invoke-Cdk -CdkArgs (@('destroy') + $existing + @('--force') + (Get-CdkAssemblyArgs))
  Write-Ok 'CloudFormation deletions finished'
}

# --- 9. Purge what the stacks retain -----------------------------------------
# Deleting the audit trail, the user pool and any leftover bucket is an
# administrative act, not a removal policy: it happens only under -PurgeData,
# and only after every stack is gone.

if ($PurgeData) {
  Write-Step 'Purging the resources the stacks retain'
  $purged = Remove-RetainedResources
  Write-CheckReport -Checks $purged | Out-Null
}

# --- 10. What is left --------------------------------------------------------

Write-Step 'Leftovers'
$leftovers = @()

$tableNames = Invoke-Aws -AllowFailure -Arguments @('dynamodb', 'list-tables', '--query', 'TableNames')
$remainingTables = @()
if ($tableNames) { $remainingTables = @($Global:MsDataTables | Where-Object { $tableNames -contains $_ }) }
if ($remainingTables.Count -gt 0) {
  $leftovers += New-Check -Name 'DynamoDB' -Status 'warn' -Detail ($remainingTables -join ', ') `
    -Fix 'aws dynamodb delete-table --table-name <name>, or the next deploy fails with AlreadyExists'
} else {
  $leftovers += New-Check -Name 'DynamoDB' -Status 'ok' -Detail 'no table left'
}

$pools = Invoke-Aws -AllowFailure -Arguments @(
  'cognito-idp', 'list-user-pools', '--max-results', '60',
  '--query', "UserPools[?Name=='memorysmith-users'].Id"
)
if ($pools -and @($pools).Count -gt 0) {
  $leftovers += New-Check -Name 'Cognito' -Status 'warn' -Detail ("user pool $(@($pools) -join ', ')") `
    -Fix 'aws cognito-idp delete-user-pool --user-pool-id <id> after deleting its domain'
} else {
  $leftovers += New-Check -Name 'Cognito' -Status 'ok' -Detail 'no user pool left'
}

$buckets = Invoke-Aws -AllowFailure -Arguments @(
  's3api', 'list-buckets', '--query', "Buckets[?starts_with(Name, 'memorysmith')].Name"
)
if ($buckets -and @($buckets).Count -gt 0) {
  $leftovers += New-Check -Name 'S3' -Status 'warn' -Detail (@($buckets) -join ', ') `
    -Fix 'empty and delete each bucket by hand if you really want the bytes gone'
} else {
  $leftovers += New-Check -Name 'S3' -Status 'ok' -Detail 'no bucket left'
}

$stillUp = @()
foreach ($stack in $requested) {
  if (Get-StackStatus -StackName $stack) { $stillUp += $stack }
}
if ($stillUp.Count -gt 0) {
  $leftovers += New-Check -Name 'CloudFormation' -Status 'gap' -Detail ($stillUp -join ', ') `
    -Fix 'check the events of the stack in the console: a delete usually stalls on a non-empty bucket'
} else {
  $leftovers += New-Check -Name 'CloudFormation' -Status 'ok' -Detail 'every requested stack is gone'
}

$leftoverGaps = Write-CheckReport -Checks $leftovers

$elapsed = (Get-Date) - $started
Write-Host ''
if ($leftoverGaps -gt 0) {
  Write-Warn ("tear down finished in {0:mm\:ss}, but some stacks are still there" -f $elapsed)
  exit 1
}
Write-Ok ("tear down finished in {0:mm\:ss}" -f $elapsed)
# Explicit, so the exit code is the script's and not that of the last native
# command that happened to run inside it.
exit 0
