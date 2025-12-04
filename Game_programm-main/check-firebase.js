// Скрипт для проверки конфигурации Firebase
// Запустите: node check-firebase.js

import { readFileSync } from 'fs';

try {
    const configFile = readFileSync('firebase-config.js', 'utf8');
    
    // Проверяем наличие заполненных значений
    const checks = {
        apiKey: !configFile.includes('YOUR_API_KEY') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        authDomain: !configFile.includes('YOUR_AUTH_DOMAIN') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        databaseURL: !configFile.includes('YOUR_DATABASE_URL') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        projectId: !configFile.includes('YOUR_PROJECT_ID') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        storageBucket: !configFile.includes('YOUR_STORAGE_BUCKET') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        messagingSenderId: !configFile.includes('YOUR_MESSAGING_SENDER_ID') && !configFile.includes('ВСТАВЬТЕ_СЮДА'),
        appId: !configFile.includes('YOUR_APP_ID') && !configFile.includes('ВСТАВЬТЕ_СЮДА')
    };
    
    const allConfigured = Object.values(checks).every(v => v === true);
    
    if (allConfigured) {
        console.log('✅ Firebase конфигурация заполнена правильно!');
    } else {
        console.log('❌ Firebase конфигурация не заполнена:');
        Object.entries(checks).forEach(([key, value]) => {
            if (!value) {
                console.log(`   - ${key}: не заполнено`);
            }
        });
        console.log('\n📖 См. инструкцию: ШАГИ_НАСТРОЙКИ_FIREBASE.md');
    }
} catch (error) {
    console.error('❌ Ошибка чтения файла firebase-config.js:', error.message);
}

