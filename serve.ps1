# SIGWART_OS // local uplink - tiny static file server (PowerShell 5.1, no admin, no deps)
# Raw TcpListener (no HttpListener URLACL issues). GET/HEAD only. Serves the folder it lives in.
param(
  [int]$Port = 4173,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPrefix = $root.TrimEnd('\') + '\'

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.htm'   = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.mjs'   = 'text/javascript; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.map'   = 'application/json; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.webp'  = 'image/webp'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.gif'   = 'image/gif'
  '.ico'   = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.woff'  = 'font/woff'
  '.txt'   = 'text/plain; charset=utf-8'
  '.wasm'  = 'application/wasm'
  '.webmanifest' = 'application/manifest+json'
}

# --- bind (with fallback ports) ---------------------------------------------
$listener = $null
$bound = 0
foreach ($p in $Port..($Port + 10)) {
  try {
    $candidate = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $candidate.Start()
    $listener = $candidate
    $bound = $p
    break
  } catch {
    $listener = $null
  }
}
if ($null -eq $listener) {
  Write-Host ("[FATAL] no free port between {0} and {1}" -f $Port, ($Port + 10))
  exit 1
}

Write-Host ''
Write-Host '  ================================================'
Write-Host '   SIGWART_OS // LOCAL UPLINK ONLINE'
Write-Host ("   http://localhost:{0}/" -f $bound)
Write-Host ("   root: {0}" -f $root)
Write-Host '   close this window (or Ctrl+C) to power down'
Write-Host '  ================================================'
Write-Host ''

if ($OpenBrowser) { Start-Process ("http://localhost:{0}/" -f $bound) }

$ascii = [System.Text.Encoding]::ASCII

function Send-Response {
  param($Stream, [string]$Status, [string]$ContentType, [byte[]]$Body, [bool]$HeadOnly)
  $len = 0
  if ($null -ne $Body) { $len = $Body.Length }
  $head = "HTTP/1.1 $Status`r`nContent-Type: $ContentType`r`nContent-Length: $len`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $hb = $ascii.GetBytes($head)
  $Stream.Write($hb, 0, $hb.Length)
  if (-not $HeadOnly -and $len -gt 0) { $Stream.Write($Body, 0, $len) }
  $Stream.Flush()
}

# --- serve loop ---------------------------------------------------------------
while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 5000
    $client.SendTimeout    = 15000
    $stream = $client.GetStream()

    # browsers open speculative connections that never send bytes - don't block on them
    $deadline = [DateTime]::UtcNow.AddSeconds(2)
    while (-not $stream.DataAvailable -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 10 }
    if (-not $stream.DataAvailable) { continue }

    $reader = New-Object System.IO.StreamReader($stream, $ascii, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
    while ($true) {
      $h = $reader.ReadLine()
      if ($null -eq $h) { break }
      if ($h -eq '') { break }
    }

    $parts = $requestLine.Split(' ')
    if ($parts.Count -lt 2) { continue }
    $method = $parts[0].ToUpperInvariant()
    $rawUrl = $parts[1]
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    $path = $rawUrl.Split('?')[0].Split('#')[0]
    try { $path = [System.Uri]::UnescapeDataString($path) } catch { }
    if ($path -eq '' -or $path -eq '/') { $path = '/index.html' }

    if ($method -ne 'GET' -and $method -ne 'HEAD') {
      Send-Response $stream '405 Method Not Allowed' 'text/plain; charset=utf-8' ($ascii.GetBytes('405')) $false
      Write-Host ("  405 {0} {1}" -f $method, $path)
      continue
    }

    $rel = $path.TrimStart('/').Replace('/', '\')
    $file = ''
    try { $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel)) } catch { $file = '' }

    if ($file -eq '' -or -not $file.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream '403 Forbidden' 'text/plain; charset=utf-8' ($ascii.GetBytes('403')) ($method -eq 'HEAD')
      Write-Host ("  403 {0}" -f $path)
      continue
    }

    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }

    if (-not (Test-Path $file -PathType Leaf)) {
      Send-Response $stream '404 Not Found' 'text/plain; charset=utf-8' ($ascii.GetBytes('404 // SIGNAL LOST')) ($method -eq 'HEAD')
      Write-Host ("  404 {0}" -f $path)
      continue
    }

    $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    $ctype = $mime[$ext]
    if ($null -eq $ctype) { $ctype = 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    Send-Response $stream '200 OK' $ctype $bytes ($method -eq 'HEAD')
    Write-Host ("  200 {0} ({1:n0} B, {2} ms)" -f $path, $bytes.Length, $sw.ElapsedMilliseconds)
  } catch {
    # connection resets / read timeouts are routine - keep serving
  } finally {
    if ($null -ne $client) { try { $client.Close() } catch { } }
  }
}
