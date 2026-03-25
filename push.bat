@echo off
title ChaosZero Toolkit - Git Push

set GIT=F:\Git\cmd\git.exe

echo ============================================
echo   ChaosZero Toolkit - Git Push to GitHub
echo ============================================
echo.

if not exist "%GIT%" (
    echo [ERROR] Git not found at %GIT%
    pause
    exit /b 1
)

cd /d "F:\anti hanhua\kaesi\ChaosZero-Toolkit"

"%GIT%" rev-parse --git-dir >nul 2>&1
if %errorlevel% neq 0 (
    echo [1] Initializing git...
    "%GIT%" init
    "%GIT%" branch -M main
)

"%GIT%" remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [2] Adding remote...
    "%GIT%" remote add origin https://github.com/NineS11942/ChaosZeroYuna-Engine-Unpacker-Simplified-Chinese-Localization-Patch.git
)

"%GIT%" config user.name >nul 2>&1
if %errorlevel% neq 0 (
    "%GIT%" config user.name "NineS11942"
    "%GIT%" config user.email "NineS11942@users.noreply.github.com"
)

echo [3] Adding files...
"%GIT%" add .
echo.

echo [4] Committing...
"%GIT%" commit -m "update ChaosZero-Toolkit"
echo.

echo [5] Pushing to GitHub...
"%GIT%" push -u origin main --force
echo.

if %errorlevel% equ 0 (
    echo ============================================
    echo   Push OK!
    echo ============================================
) else (
    echo ============================================
    echo   Push FAILED!
    echo ============================================
)

pause
