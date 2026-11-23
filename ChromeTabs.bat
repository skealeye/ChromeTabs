@echo off
rem Launch ChromeTabs. Installs dependencies on first run.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo First run: installing dependencies...
  call npm install || (pause & exit /b 1)
)
start "" "node_modules\electron\dist\electron.exe" .
