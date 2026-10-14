@echo off
REM Chennai Relief Control - starts the API (port 8765) and the web app (port 5273).
setlocal
cd /d "%~dp0"

REM reuse the virtual environment from the earlier version of this project if it is there
set "VENV=.venv"
if exist backend\.venv\Scripts\activate.bat set "VENV=backend\.venv"
if not exist %VENV%\Scripts\activate.bat (
  echo Creating Python environment...
  python -m venv %VENV%
)
call %VENV%\Scripts\activate.bat
pip install -q -r backend\requirements.txt

REM always refresh web packages: this version adds the 3D map library
pushd frontend
call npm install
popd

start "Chennai Relief - API" cmd /k "cd /d %~dp0 && call %VENV%\Scripts\activate.bat && python -m uvicorn backend.main:app --port 8765"
start "Chennai Relief - Web" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Opening http://localhost:5273 in your browser...
timeout /t 8 /nobreak >nul
start "" http://localhost:5273
echo The first start downloads Chennai's real road network (about 1-2 minutes, needs internet).
endlocal
