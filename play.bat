@echo off
setlocal
cd /d "%~dp0"
echo Starting MALLU FIGHTER II - Naadan Kombat Malayalam Arcade...
set "EDGE_EXE="
where msedge >nul 2>&1 && set "EDGE_EXE=msedge"
if not defined EDGE_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

where node >nul 2>&1
if %errorlevel%==0 (
  echo Starting Node server with Malayalam ml-IN Cloud TTS proxy and disk cache...
  if defined EDGE_EXE (
    start "" "%EDGE_EXE%" "http://127.0.0.1:8765/index.html"
  ) else (
    start "" "http://127.0.0.1:8765/index.html"
  )
  node server.mjs
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  if defined EDGE_EXE (
    start "" "%EDGE_EXE%" "http://127.0.0.1:8765/index.html"
  ) else (
    start "" "http://127.0.0.1:8765/index.html"
  )
  python -m http.server 8765 --bind 0.0.0.0
) else (
  if defined EDGE_EXE (
    start "" "%EDGE_EXE%" "%~dp0index.html"
  ) else (
    start "" "%~dp0index.html"
  )
)
