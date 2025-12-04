#!/bin/bash

echo "========================================"
echo "  ГосСимулятор: Запуск локального сервера"
echo "========================================"
echo ""
echo "Выберите способ запуска:"
echo ""
echo "1. Python (если установлен)"
echo "2. Node.js (если установлен)"
echo "3. PHP (если установлен)"
echo "4. Открыть index.html напрямую"
echo ""
read -p "Введите номер (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Запуск через Python..."
        echo "Откройте в браузере: http://localhost:8000"
        echo "Для остановки нажмите Ctrl+C"
        echo ""
        python3 -m http.server 8000
        ;;
    2)
        echo ""
        echo "Запуск через Node.js..."
        echo "Для остановки нажмите Ctrl+C"
        echo ""
        npx http-server -p 8000
        ;;
    3)
        echo ""
        echo "Запуск через PHP..."
        echo "Откройте в браузере: http://localhost:8000"
        echo "Для остановки нажмите Ctrl+C"
        echo ""
        php -S localhost:8000
        ;;
    4)
        echo ""
        echo "Открытие index.html..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open index.html
        else
            xdg-open index.html
        fi
        ;;
    *)
        echo ""
        echo "Неверный выбор!"
        ;;
esac

