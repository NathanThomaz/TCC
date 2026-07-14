@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo  Plataforma de Inteligencia de Mercado de TI
echo  Inicializando ambiente Airflow (Docker)...
echo ============================================
echo.

rem --- 1. Verifica se o Docker Desktop esta rodando ---
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_pronto

echo Docker Desktop nao esta rodando. Abrindo...
set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_EXE%" (
    echo [ERRO] Nao encontrei o Docker Desktop em "%DOCKER_EXE%".
    echo Abra o Docker Desktop manualmente e rode este script de novo.
    pause
    exit /b 1
)
start "" "%DOCKER_EXE%"

echo Aguardando o Docker Desktop iniciar (pode levar 1-2 minutos)...
set /a tentativas=0
:esperar_docker
timeout /t 3 >nul
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_pronto
set /a tentativas+=1
if %tentativas% geq 60 (
    echo [ERRO] O Docker Desktop nao ficou pronto a tempo. Tente rodar o script de novo.
    pause
    exit /b 1
)
echo   ainda aguardando...
goto esperar_docker

:docker_pronto
echo Docker Desktop pronto.
echo.

rem --- 2. Verifica se o .env existe ---
if not exist ".env" (
    echo [ERRO] Arquivo .env nao encontrado em projeto\.env
    echo Copie .env.exemplo para .env e preencha ADZUNA_APP_ID / ADZUNA_APP_KEY antes de continuar.
    pause
    exit /b 1
)

rem --- 3. Inicializa o banco do Airflow (idempotente - seguro rodar sempre) ---
echo Inicializando banco de dados do Airflow (se necessario)...
docker compose up airflow-init
echo.

rem --- 4. Sobe o Airflow em segundo plano ---
echo Subindo webserver e scheduler do Airflow...
docker compose up -d airflow-webserver airflow-scheduler
echo.

rem --- 5. Aguarda o webserver subir e abre o navegador ---
echo Aguardando o webserver do Airflow ficar pronto (~30-60s na primeira vez)...
timeout /t 30 >nul
start "" http://localhost:8080

echo.
echo ============================================
echo  Airflow no ar: http://localhost:8080
echo  Usuario: admin   Senha: admin
echo.
echo  Os containers continuam rodando em segundo
echo  plano mesmo se voce fechar esta janela.
echo  Para parar tudo, rode: parar.bat
echo ============================================
pause
