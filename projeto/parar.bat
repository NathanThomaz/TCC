@echo off
cd /d "%~dp0"

echo Parando os containers do Airflow...
docker compose down

echo.
echo Containers parados. Os dados em dados\ e o banco do Airflow foram preservados.
pause
