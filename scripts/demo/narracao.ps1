# Gera um .wav de narração (voz Microsoft Maria, pt-BR) para cada cena de um roteiro (padrão: roteiro.json).
# Uso: narracao.ps1 -Saida <pasta> [-Roteiro <arquivo.json>] [-Velocidade 0]   (velocidade: -10 a 10; 0 = normal)
param([string]$Saida, [string]$Roteiro = '', [int]$Velocidade = 0)
Add-Type -AssemblyName System.Speech
if (-not $Roteiro) { $Roteiro = Join-Path $PSScriptRoot 'roteiro.json' }
$cenas = Get-Content $Roteiro -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force $Saida | Out-Null
$voz = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voz.SelectVoice('Microsoft Maria Desktop')
$voz.Rate = $Velocidade
foreach ($cena in $cenas) {
    $arquivo = Join-Path $Saida "$($cena.id).wav"
    $voz.SetOutputToWaveFile($arquivo)
    $voz.Speak($cena.texto)
    $voz.SetOutputToNull()
    Write-Host "ok $($cena.id)"
}
$voz.Dispose()
