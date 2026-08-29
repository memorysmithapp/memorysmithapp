#Requires -Version 7.0
<#
.SYNOPSIS
  Recounts the stored bytes of every subscription (RN-SUB-021).

.DESCRIPTION
  The storage counter is maintained by the outbox relay, one delta at a time
  and outside the user transaction, which makes it a derived number. This is
  how it is rebuilt: it walks mv-knowledge, adds up the live content of each
  subscription and writes the counter.

  It is needed at least once for real, because the counter came into existence
  after the vaults did: every subscription written before it started at zero
  while holding a vault full of notes. After that it is a repair job, for the
  ordinary ways a delta can be lost.

  It reports first and writes only with -Apply. Run it when the accounts are
  quiet: a write that lands during the scan can be counted by the scan AND
  applied by the relay, and the recount then replaces the relay's delta.

.PARAMETER Apply
  Writes the numbers. Without it the script only reports what it measured.

.PARAMETER ProfileName
  AWS profile to use. Defaults to the standard credential chain.

.PARAMETER Region
  Target region. Defaults to the profile's region, then to us-east-1.

.EXAMPLE
  ./deploy-aws/recount-storage.ps1
  Reports what each subscription is holding, and changes nothing.

.EXAMPLE
  ./deploy-aws/recount-storage.ps1 -Apply
  Reports and then writes the counter of every subscription.
#>

[CmdletBinding()]
param(
  [switch]$Apply,
  [Alias('Profile')][string]$ProfileName,
  [string]$Region
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib' 'common.ps1')

Write-Host ''
Write-Host 'MemorySmith - storage recount'

Set-AwsContext -Region $Region -ProfileName $ProfileName

$identity = Invoke-Aws -AllowFailure -Arguments @('sts', 'get-caller-identity')
if ($null -eq $identity) {
  Write-Gap 'AWS credentials: no usable credentials for this profile'
  exit 1
}
Write-Ok "AWS credentials       account $($identity.Account)"

# The table is found by its logical id in the data stack, not by a hardcoded
# name: the name is an implementation detail of the stack.
$resources = Invoke-Aws -AllowFailure -Arguments @(
  'cloudformation', 'describe-stack-resources',
  '--stack-name', 'MemorysmithData',
  '--query', "StackResources[?starts_with(LogicalResourceId, 'KnowledgeTable')].PhysicalResourceId"
)
$table = @($resources)[0]
if (-not $table) {
  Write-Gap 'Knowledge table: MemorysmithData exposes no KnowledgeTable resource'
  exit 1
}
Write-Ok "Knowledge table       $table"

$entry = Join-Path $PSScriptRoot '..' 'memorysmith-backend' 'apps' 'core-monolith' 'src' 'recount.ts'
$arguments = @('tsx', $entry)
if ($Apply) { $arguments += '--apply' }

Write-Host ''
Write-Step (($Apply) ? 'Recounting and writing' : 'Recounting (report only)')

$env:KNOWLEDGE_TABLE = $table
if ($Global:MsAws.Profile) { $env:AWS_PROFILE = $Global:MsAws.Profile }
if ($Global:MsAws.Region) { $env:AWS_REGION = $Global:MsAws.Region }

pnpm @arguments
$code = $LASTEXITCODE

Write-Host ''
if ($code -ne 0) {
  Write-Gap "recount: the job exited with $code"
  exit $code
}
if (-not $Apply) {
  Write-Ok 'report only: run again with -Apply to write these numbers'
} else {
  Write-Ok 'the counters are up to date'
}
