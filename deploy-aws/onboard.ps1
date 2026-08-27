#Requires -Version 7.0
<#
.SYNOPSIS
  Gives an account its first subscription on a freshly deployed environment.

.DESCRIPTION
  A deploy creates no subscription, by design: a subscription is requested by a
  person and approved by a platform administrator (RN-SUB-001), and no seed
  writes one behind that rule. On a new environment that leaves the first user
  looking at the onboarding screen with nothing to enter, because the one
  administrator who could approve the request is that same person and the
  approval queue has no screen yet.

  This script closes that loop through the API, exactly as the two screens
  would: it signs in as the user, requests the subscription when there is none
  pending, and approves it as a platform administrator. Nothing is written to
  DynamoDB by hand, so the domain events and the audit trail are the same ones
  the product would have produced.

  The claim travels inside the token, so the browser only sees the subscription
  after a NEW sign-in: sign out and back in once this finishes.

.PARAMETER Email
  The account to onboard. Defaults to testUserEmail from cdk.json.

.PARAMETER SubscriptionName
  Name of the subscription to request. Defaults to 'MemorySmith'.

.PARAMETER Status
  The status the approval grants: 'active' or 'trial'. Defaults to 'active'.

.PARAMETER Region
  Target region. Defaults to CDK_DEFAULT_REGION, then to the region of the AWS
  profile, then to us-east-1.

.PARAMETER ProfileName
  AWS profile to use. Defaults to the standard credential chain.

.EXAMPLE
  ./deploy-aws/onboard.ps1 -Profile memorysmith
  Requests and approves a subscription for the test user of cdk.json.
#>

[CmdletBinding()]
param(
  [string]$Email,
  [string]$SubscriptionName = 'MemorySmith',
  [ValidateSet('active', 'trial')][string]$Status = 'active',
  [string]$Region,
  [Alias('Profile')][string]$ProfileName
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'lib' 'common.ps1')

Write-Host ''
Write-Host 'MemorySmith - first subscription' -ForegroundColor White

# --- 1. Context --------------------------------------------------------------

Set-AwsContext -Region $Region -ProfileName $ProfileName

$context = Get-CdkContext
$zoneName = $context.hostedZoneName
$user = if ($Email) { $Email } else { $context.testUserEmail }
$apiOrigin = "https://api.$zoneName"

if (-not $user) {
  throw 'No account to onboard: pass -Email, or set testUserEmail in memorysmith-infra/cdk.json.'
}

$identity = Get-StackOutputs -StackName 'MemorysmithIdentity'
if (-not $identity -or -not $identity['UserPoolId'] -or -not $identity['WebClientId']) {
  throw 'MemorysmithIdentity has no outputs; deploy the environment before onboarding anyone.'
}

Write-Step 'Environment'
Write-Host "  api              $apiOrigin"
Write-Host "  user pool        $($identity['UserPoolId'])"
Write-Host "  account          $user"

# --- 2. Sign in --------------------------------------------------------------
# The admin flow, not the hosted UI: this needs IAM permission on the pool, so
# it grants nothing to whoever holds only the password. It is the same flow the
# deploy verification uses.

Write-Step 'Signing in'
$secure = Read-Host "  password for $user" -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $secure).Password
if (-not $password) { throw 'No password given.' }

# The parameters go as JSON, not as the key=value shorthand: a password is
# allowed to carry a comma or an equals sign, and the shorthand parser would
# read either one as the start of another parameter.
$parameters = @{ USERNAME = $user; PASSWORD = $password } | ConvertTo-Json -Compress
$auth = Invoke-Aws -AllowFailure -Arguments @(
  'cognito-idp', 'admin-initiate-auth',
  '--user-pool-id', $identity['UserPoolId'],
  '--client-id', $identity['WebClientId'],
  '--auth-flow', 'ADMIN_USER_PASSWORD_AUTH',
  '--auth-parameters', $parameters
)
if (-not $auth) { throw "Could not sign in as $user. Wrong password, or the account is not confirmed." }
if ($auth.ChallengeName) {
  throw "Cognito answered with the challenge '$($auth.ChallengeName)'. Finish it on the sign-in page at https://auth.$zoneName and run this again."
}

$token = $auth.AuthenticationResult.AccessToken
if (-not $token) { throw 'Sign-in returned no access token.' }
Write-Ok 'signed in'

# --- 3. What the session already has -----------------------------------------

function Invoke-Api {
  <# One call to the product API as the signed-in user. Returns the parsed body,
     or $null for an empty one. Throws with the API's own error payload. #>
  param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [object]$Body
  )
  $arguments = @{
    Uri                = "$apiOrigin$Path"
    Method             = $Method
    Headers            = @{ Authorization = "Bearer $token" }
    SkipHttpErrorCheck = $true
    TimeoutSec         = 30
  }
  if ($null -ne $Body) {
    $arguments['Body'] = ($Body | ConvertTo-Json -Compress)
    $arguments['ContentType'] = 'application/json'
  }
  $response = Invoke-WebRequest @arguments
  if ($response.StatusCode -ge 400) {
    throw "$Method $Path answered $($response.StatusCode): $($response.Content)"
  }
  if (-not $response.Content) { return $null }
  return ($response.Content | ConvertFrom-Json)
}

Write-Step 'Reading the session'
$session = Invoke-Api -Method 'GET' -Path '/access/session'
if (-not $session.user.isPlatformAdmin) {
  throw "$user is not in the platform-admin group, so it cannot approve anything. Add it to the group and run this again."
}
if ($session.activeSubscription) {
  Write-Ok "$user already acts for $($session.activeSubscription.subscriptionId)"
  Write-Detail 'nothing to do'
  exit 0
}
Write-Detail 'no active subscription in the token, as expected on a new environment'

# --- 4. Request --------------------------------------------------------------
# A request that is already waiting is reused: asking twice would leave two
# subscriptions in the queue and only one of them would ever be entered.

$pending = Invoke-Api -Method 'GET' -Path '/access/platform/subscriptions?status=pending_approval'
$mine = @($pending | Where-Object { $_.ownerEmail -eq $user })

if ($mine.Count -gt 0) {
  $subscriptionId = $mine[0].subscriptionId
  Write-Step 'Reusing the request already in the queue'
  Write-Ok $subscriptionId
} else {
  Write-Step "Requesting '$SubscriptionName'"
  $created = Invoke-Api -Method 'POST' -Path '/access/subscriptions' -Body @{ name = $SubscriptionName }
  $subscriptionId = $created.subscriptionId
  if (-not $subscriptionId) { throw 'The request returned no subscription id.' }
  Write-Ok $subscriptionId
}

# --- 5. Approve --------------------------------------------------------------

Write-Step "Approving it as $Status"
Invoke-Api -Method 'POST' -Path "/access/platform/subscriptions/$subscriptionId/approve" `
  -Body @{ status = $Status } | Out-Null
Write-Ok "$subscriptionId is $Status"

# --- 6. What happens next ----------------------------------------------------

Write-Host ''
Write-Ok 'the account has a subscription'
Write-Detail "the claim is minted when the token is, so sign out of https://$zoneName and sign in again"
exit 0
