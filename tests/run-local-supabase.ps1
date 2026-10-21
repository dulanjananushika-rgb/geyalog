$ErrorActionPreference = 'Stop'

$savedErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $statusOutput = & npx.cmd --yes supabase@2.120.0 status --output json 2>&1
  $statusExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $savedErrorActionPreference
}
if ($statusExitCode -ne 0) {
  throw 'Supabase CLI could not read local status. Start the local stack with npx supabase start first.'
}
$statusText = ($statusOutput | ForEach-Object { "$($_)" }) -join "`n"
$jsonStart = $statusText.IndexOf('{')
$jsonEnd = $statusText.LastIndexOf('}')
if ($jsonStart -lt 0 -or $jsonEnd -lt $jsonStart) {
  throw 'Supabase CLI did not return local status JSON.'
}
$statusJson = $statusText.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
$status = $statusJson | ConvertFrom-Json
if ($status.API_URL -ne 'http://127.0.0.1:54321') {
  throw 'Refusing to run integration tests unless the local Supabase API is at 127.0.0.1:54321.'
}
if (-not $status.ANON_KEY -or -not $status.SERVICE_ROLE_KEY) {
  throw 'Local Supabase keys were not returned by the CLI.'
}

$env:GEYALOG_RUN_LOCAL_SUPABASE_TESTS = '1'
$env:GEYALOG_LOCAL_SUPABASE_URL = $status.API_URL
$env:GEYALOG_LOCAL_SUPABASE_ANON_KEY = $status.ANON_KEY
$env:GEYALOG_LOCAL_SUPABASE_SERVICE_ROLE_KEY = $status.SERVICE_ROLE_KEY

node --test tests/supabase-local.integration.test.mjs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
