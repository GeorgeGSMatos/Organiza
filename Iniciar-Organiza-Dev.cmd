@echo off
setlocal
title Organiza - Desenvolvimento
echo Iniciando o Organiza em desenvolvimento...
echo Projeto: %~dp0
echo.
if not exist "%~dp0scripts\Start-OrganizaDev.ps1" goto missing_project
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-OrganizaDev.ps1"
set "ORGANIZA_DEV_EXIT=%ERRORLEVEL%"
echo.
if not "%ORGANIZA_DEV_EXIT%"=="0" echo Nao foi possivel iniciar ou continuar. Codigo: %ORGANIZA_DEV_EXIT%
if "%ORGANIZA_DEV_EXIT%"=="0" echo A sessao de desenvolvimento foi encerrada.
echo Se a janela do Organiza nao abriu, envie uma captura das mensagens acima.
pause
exit /b %ORGANIZA_DEV_EXIT%

:missing_project
echo Nao encontrei a pasta scripts ao lado deste CMD.
echo Abra o arquivo original dentro da pasta completa do projeto no WSL.
echo Baixar ou copiar somente este CMD pelo chat nao inclui o aplicativo.
pause
exit /b 1
