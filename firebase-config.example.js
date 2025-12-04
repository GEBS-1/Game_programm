// Пример конфигурации Firebase
// Скопируйте этот файл как firebase-config.js и заполните своими данными
// Получить данные можно в Firebase Console: https://console.firebase.google.com/

export const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Инструкция:
// 1. Перейдите на https://console.firebase.google.com/
// 2. Создайте новый проект или выберите существующий
// 3. В настройках проекта (Settings → Project settings) найдите раздел "Your apps"
// 4. Добавьте веб-приложение (Web app) если его ещё нет
// 5. Скопируйте значения из конфигурации Firebase SDK
// 6. Вставьте их в этот файл (сохраните как firebase-config.js)

