# Instala o driver ODBC "SQL Anywhere 17" (64 bits) neste PC -- é ele que o Prazos usa pra ler o banco do Domínio.
#
# A SAP não publica um link direto e público do instalador (o download exige conta SAP), então este script:
#   1. confere se o driver já está instalado;
#   2. procura o instalador (sqla17*.exe / *.msi) ao lado do script, na pasta Downloads ou numa pasta informada em -Pasta;
#   3. se você tiver um link direto do instalador (ex.: um compartilhamento do escritório), informe em -Url
#      (ou grave o link numa linha do arquivo driver-url.txt ao lado do script);
#   4. se nada disso existir, abre a página de downloads da SAP e explica o que fazer.
#
# Uso:  powershell -ExecutionPolicy Bypass -File instalar-driver-odbc.ps1 [-Url <link>] [-Pasta <pasta>]
param(
    [string]$Url,
    [string]$Pasta
)

$ErrorActionPreference = 'Stop'
$driver = 'SQL Anywhere 17'
$chave = "HKLM:\SOFTWARE\ODBC\ODBCINST.INI\$driver"
$paginaSap = 'https://support.sap.com/en/my-support/software-downloads.html'

function Pausa { Write-Host ''; Read-Host 'Pressione Enter para fechar' | Out-Null }

if (Test-Path $chave) {
    Write-Host "O driver ODBC '$driver' já está instalado neste PC. Nada a fazer." -ForegroundColor Green
    Pausa; exit 0
}

# a instalação precisa de administrador
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Write-Host 'Pedindo permissão de administrador...'
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Url) { $args += @('-Url', "`"$Url`"") }
    if ($Pasta) { $args += @('-Pasta', "`"$Pasta`"") }
    Start-Process powershell -Verb RunAs -ArgumentList $args
    exit 0
}

$instalador = $null

if (-not $Url) {
    $arquivoUrl = Join-Path $PSScriptRoot 'driver-url.txt'
    if (Test-Path $arquivoUrl) { $Url = (Get-Content $arquivoUrl | Where-Object { $_.Trim() -and -not $_.StartsWith('#') } | Select-Object -First 1) }
}

if (-not $Url) {
    $pastas = @($Pasta, $PSScriptRoot, (Join-Path $env:USERPROFILE 'Downloads')) | Where-Object { $_ -and (Test-Path $_) }
    foreach ($p in $pastas) {
        $achado = Get-ChildItem $p -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(sqla|sqlanywhere|sql_anywhere).*17.*\.(exe|msi)$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($achado) { $instalador = $achado.FullName; break }
    }
}

if ($Url) {
    $nome = [IO.Path]::GetFileName(([Uri]$Url).AbsolutePath)
    if (-not $nome -or $nome -notmatch '\.(exe|msi)$') { $nome = 'sqlanywhere17-driver.exe' }
    $instalador = Join-Path $env:TEMP $nome
    Write-Host "Baixando $Url ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $Url -OutFile $instalador -UseBasicParsing
}

if (-not $instalador) {
    Write-Host "Não encontrei o instalador do driver '$driver'." -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Como obter:'
    Write-Host ' - Peça o instalador do SQL Anywhere 17 (cliente / driver ODBC, 64 bits) a quem administra o Domínio no escritório;'
    Write-Host '   ele costuma estar na pasta de instalação do Domínio no servidor.'
    Write-Host ' - Ou baixe no portal de downloads da SAP (exige conta SAP): SQL Anywhere 17 > cliente Windows 64 bits.'
    Write-Host ''
    Write-Host 'Depois, coloque o arquivo (ex.: sqla17client.exe) na pasta Downloads e rode este script de novo,'
    Write-Host 'ou informe o caminho:  -Pasta "C:\caminho"   (ou um link direto:  -Url "https://...")'
    Start-Process $paginaSap
    Pausa; exit 1
}

Write-Host "Instalando: $instalador"
if ($instalador -match '\.msi$') {
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$instalador`" /passive /norestart" -Wait -PassThru
} else {
    $p = Start-Process $instalador -Wait -PassThru
}

if (Test-Path $chave) {
    Write-Host "Pronto: o driver ODBC '$driver' foi instalado." -ForegroundColor Green
    Pausa; exit 0
}
Write-Host "A instalação terminou (código $($p.ExitCode)), mas o driver '$driver' não apareceu no Windows." -ForegroundColor Red
Write-Host 'Confira se o instalador é o do SQL Anywhere 17, versão cliente 64 bits.'
Pausa; exit 1
