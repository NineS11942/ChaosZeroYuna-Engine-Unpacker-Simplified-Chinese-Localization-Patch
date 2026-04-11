@echo off
title ChaosZero Toolkit Build (PyInstaller)

echo ============================================
echo   ChaosZero Toolkit - PyInstaller Build
echo ============================================
echo.

where pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] PyInstaller not found, installing...
    pip install pyinstaller
    echo.
)

echo [1/3] Cleaning old build...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "ChaosZero-Toolkit.spec" del /q "ChaosZero-Toolkit.spec"
echo      Done.
echo.

echo [2/3] Building exe with PyInstaller...
pyinstaller --onefile --noconsole --name ChaosZero-Toolkit --add-data "rebuild_ko_to_zht.py;." --add-data "unpack_data.py;." --hidden-import=customtkinter --collect-all customtkinter chaoszero_toolkit_gui.py

if %errorlevel% neq 0 (
    echo.
    echo [X] Build FAILED!
    pause
    exit /b 1
)

echo.
echo [3/3] Copying TSV files to dist...
copy "text_ko_text.tsv" "dist\text_ko_text.tsv" >nul 2>&1
copy "..\text_ko_text(纯繁转简).tsv" "dist\text_ko_text(纯繁转简).tsv" >nul 2>&1

echo.
echo ============================================
echo   Build OK!
echo   Output: dist\ChaosZero-Toolkit.exe
echo           dist\text_ko_text.tsv
echo ============================================

explorer "dist"
pause
