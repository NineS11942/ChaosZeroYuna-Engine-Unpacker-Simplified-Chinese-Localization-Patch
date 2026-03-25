@echo off
title ChaosZero Toolkit Build (Nuitka)

echo ============================================
echo   ChaosZero Toolkit - Nuitka Build
echo ============================================
echo.

where nuitka >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Nuitka not found, installing...
    pip install nuitka
    echo.
)

echo [1/3] Cleaning old build...
if exist "chaoszero_toolkit_gui.dist" rmdir /s /q "chaoszero_toolkit_gui.dist"
if exist "chaoszero_toolkit_gui.build" rmdir /s /q "chaoszero_toolkit_gui.build"
if exist "dist" rmdir /s /q "dist"
echo      Done.
echo.

echo [2/3] Building exe with Nuitka (may take a few minutes)...
python -m nuitka --onefile --enable-plugin=tk-inter --include-package-data=customtkinter --include-data-files=rebuild_ko_to_zht.py=rebuild_ko_to_zht.py --include-data-files=unpack_data.py=unpack_data.py --output-dir=dist --output-filename=ChaosZero-Toolkit.exe chaoszero_toolkit_gui.py

if %errorlevel% neq 0 (
    echo.
    echo [X] Build FAILED!
    pause
    exit /b 1
)

echo.
echo [3/3] Copying TSV to dist...
copy "text_ko_text.tsv" "dist\text_ko_text.tsv" >nul 2>&1

echo.
echo ============================================
echo   Build OK!
echo   Output: dist\ChaosZero-Toolkit.exe
echo           dist\text_ko_text.tsv
echo ============================================

explorer "dist"
pause
