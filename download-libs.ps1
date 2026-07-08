# SIGWART_OS // vendored library supply drop (re-runnable)
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File download-libs.ps1 [-Force]
param([switch]$Force)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = 'https://cdn.jsdelivr.net/npm'

$manifest = @(
  @{ url = "$base/three@0.180.0/build/three.module.min.js";                                        out = 'lib\three\three.module.min.js' }
  @{ url = "$base/three@0.180.0/build/three.core.min.js";                                          out = 'lib\three\three.core.min.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js";                    out = 'lib\three\addons\postprocessing\EffectComposer.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/Pass.js";                              out = 'lib\three\addons\postprocessing\Pass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/ShaderPass.js";                        out = 'lib\three\addons\postprocessing\ShaderPass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/MaskPass.js";                          out = 'lib\three\addons\postprocessing\MaskPass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/RenderPass.js";                        out = 'lib\three\addons\postprocessing\RenderPass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass.js";                   out = 'lib\three\addons\postprocessing\UnrealBloomPass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/postprocessing/OutputPass.js";                        out = 'lib\three\addons\postprocessing\OutputPass.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/shaders/CopyShader.js";                               out = 'lib\three\addons\shaders\CopyShader.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/shaders/LuminosityHighPassShader.js";                 out = 'lib\three\addons\shaders\LuminosityHighPassShader.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/shaders/OutputShader.js";                             out = 'lib\three\addons\shaders\OutputShader.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/objects/Reflector.js";                                out = 'lib\three\addons\objects\Reflector.js' }
  @{ url = "$base/three@0.180.0/examples/jsm/controls/OrbitControls.js";                           out = 'lib\three\addons\controls\OrbitControls.js' }
  @{ url = "$base/gsap@3.15.0/dist/gsap.min.js";                                                   out = 'lib\gsap\gsap.min.js' }
  @{ url = "$base/gsap@3.15.0/dist/ScrollTrigger.min.js";                                          out = 'lib\gsap\ScrollTrigger.min.js' }
  @{ url = "$base/gsap@3.15.0/dist/Draggable.min.js";                                              out = 'lib\gsap\Draggable.min.js' }
  @{ url = "$base/gsap@3.15.0/dist/InertiaPlugin.min.js";                                          out = 'lib\gsap\InertiaPlugin.min.js' }
  @{ url = "$base/lenis@1.3.25/dist/lenis.min.js";                                                 out = 'lib\lenis\lenis.min.js' }
  @{ url = "$base/@fontsource/orbitron@5.2.8/files/orbitron-latin-500-normal.woff2";               out = 'lib\fonts\orbitron-latin-500-normal.woff2' }
  @{ url = "$base/@fontsource/orbitron@5.2.8/files/orbitron-latin-800-normal.woff2";               out = 'lib\fonts\orbitron-latin-800-normal.woff2' }
  @{ url = "$base/@fontsource/jetbrains-mono@5.2.8/files/jetbrains-mono-latin-400-normal.woff2";   out = 'lib\fonts\jetbrains-mono-latin-400-normal.woff2' }
  @{ url = "$base/@fontsource/jetbrains-mono@5.2.8/files/jetbrains-mono-latin-700-normal.woff2";   out = 'lib\fonts\jetbrains-mono-latin-700-normal.woff2' }
)

$failed = @()
Write-Host ''
Write-Host '  SIGWART_OS // VENDOR SUPPLY DROP'
Write-Host ("  target: {0}" -f $root)
Write-Host ''

foreach ($item in $manifest) {
  $dest = Join-Path $root $item.out
  $dir  = Split-Path -Parent $dest
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  $have = $false
  if (Test-Path $dest) { if ((Get-Item $dest).Length -gt 0) { $have = $true } }
  if ($have -and -not $Force) {
    Write-Host ("  [skip] {0}" -f $item.out)
    continue
  }

  & curl.exe -fsSL --retry 3 --connect-timeout 15 -o $dest $item.url
  $ok = ($LASTEXITCODE -eq 0) -and (Test-Path $dest)
  if ($ok) { if ((Get-Item $dest).Length -le 0) { $ok = $false } }

  if ($ok) {
    Write-Host ("  [ ok ] {0}  ({1:n1} KB)" -f $item.out, ((Get-Item $dest).Length / 1KB))
  } else {
    $failed += $item.url
    Write-Host ("  [FAIL] {0}" -f $item.url)
    if (Test-Path $dest) { Remove-Item $dest -Force }
  }
}

Write-Host ''
if ($failed.Count -gt 0) {
  Write-Host ("  {0} download(s) FAILED:" -f $failed.Count)
  $failed | ForEach-Object { Write-Host ("   - {0}" -f $_) }
  exit 1
}

$total = (Get-ChildItem (Join-Path $root 'lib') -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ("  supply drop complete - lib\ holds {0:n1} KB" -f ($total / 1KB))
exit 0
