@echo off
echo ========================================
echo   ГосСимулятор: Запуск локального сервера
echo ========================================
echo.
echo Выберите способ запуска:
echo.
echo 1. Python (если установлен)
echo 2. Node.js (если установлен)
echo 3. PHP (если установлен)
echo 4. Открыть index.html напрямую
echo.
set /p choice="Введите номер (1-4): "

if "%choice%"=="1" (
    echo.
    echo Запуск через Python...
    echo Откройте в браузере: http://localhost:8000
    echo Для остановки нажмите Ctrl+C
    echo.
    python -m http.server 8000
) else if "%choice%"=="2" (
    echo.
    echo Запуск через Node.js...
    echo Для остановки нажмите Ctrl+C
    echo.
    npx http-server -p 8000
) else if "%choice%"=="3" (
    echo.
    echo Запуск через PHP...
    echo Откройте в браузере: http://localhost:8000
    echo Для остановки нажмите Ctrl+C
    echo.
    php -S localhost:8000
) else if "%choice%"=="4" (
    echo.
    echo Открытие index.html...
    start index.html
) else (
    echo.
    echo Неверный выбор!
    pause
)

