// Импорт Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// Глобальные переменные
let app = null;
let database = null;
let firebaseReady = false;
let currentGameCode = "";
let playerId = "";
let isHost = false;
let selectedCompetence = null;
let selectedResource = null;
let playerCards = null;

// Хранилище для отписки от подписок Firebase
let gameValueUnsubscribe = null;
let playerValueUnsubscribe = null;
let isGamePageInitialized = false;
let isRegisteringPlayer = false; // Флаг для защиты от множественной регистрации

// Данные игры (загружаются из JSON файлов)
let ministries = [];
let competences = [];
let resources = [];
let stressCases = [];
let regularCases = [];

// Проверка и инициализация Firebase
try {
    // Проверка наличия конфигурации Firebase
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        firebaseReady = true;
        console.log("✅ Firebase инициализирован");
    } else {
        console.warn("⚠️ ВНИМАНИЕ: Firebase не настроен. Работает демо-режим.");
        console.warn("⚠️ Для полной функциональности настройте firebase-config.js");
    }
} catch (error) {
    console.error("❌ Ошибка инициализации Firebase:", error);
    console.warn("⚠️ Работает демо-режим без синхронизации данных");
}

// Функция создания игры
async function createGame() {
    try {
        const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        currentGameCode = gameCode;
        isHost = true;
        
        // Загружаем данные перед созданием игры
        await loadGameData();
        
        if (firebaseReady && database) {
            // Создаём игру в Firebase
            const gameRef = ref(database, `games/${gameCode}`);
            await set(gameRef, {
                status: "waiting",
                players: {},
                currentCase: null,
                currentRound: 0,
                gameStarted: false,
                createdAt: Date.now()
            });
            console.log("✅ Игра создана в Firebase:", gameCode);
        } else {
            // Демо-режим: сохраняем только локально
            console.log("⚠️ Демо-режим: игра создана локально:", gameCode);
            alert("⚠️ ДЕМО-РЕЖИМ\n\nFirebase не настроен. Игра работает локально.\nДля полной функциональности настройте Firebase.\n\nКод игры: " + gameCode);
        }
        
        // Сохраняем данные в localStorage
        localStorage.setItem('gameData', JSON.stringify({
            gameCode: gameCode,
            playerId: 'host',
            isHost: true
        }));
        
        // Показываем код игры
        const codeElement = document.getElementById('gameCode');
        const sectionElement = document.getElementById('gameCodeSection');
        
        if (codeElement) {
            codeElement.textContent = gameCode;
        }
        if (sectionElement) {
            sectionElement.style.display = 'block';
        }
        
        console.log("Игра создана:", gameCode);
    } catch (error) {
        console.error("Ошибка создания игры:", error);
        const errorMsg = firebaseReady 
            ? "Ошибка создания игры. Проверьте конфигурацию Firebase."
            : "Ошибка создания игры. Проверьте консоль браузера (F12) для деталей.";
        alert(errorMsg + "\n\nОшибка: " + error.message);
    }
}

// Функция начала игры (для ведущего)
async function startGame() {
    if (!currentGameCode) {
        alert("Сначала создайте игру!");
        return;
    }
    
    try {
        if (firebaseReady && database) {
            const gameRef = ref(database, `games/${currentGameCode}`);
            await update(gameRef, {
                gameStarted: true,
                status: "playing"
            });
        } else {
            console.log("⚠️ Демо-режим: начало игры");
        }
        
        // Переходим на игровую страницу
        window.location.href = "game.html";
    } catch (error) {
        console.error("Ошибка начала игры:", error);
        alert("Ошибка начала игры: " + error.message);
    }
}

// Функция присоединения к игре
async function joinGame() {
    const playerNameInput = document.getElementById('playerName');
    const inputCodeInput = document.getElementById('inputGameCode');
    const joinStatusElement = document.getElementById('joinStatus');
    
    if (!playerNameInput || !inputCodeInput) {
        alert("Ошибка: элементы формы не найдены!");
        return;
    }
    
    const playerName = playerNameInput.value.trim();
    const inputCode = inputCodeInput.value.toUpperCase().trim();
    
    if (!playerName || !inputCode) {
        alert("Введите имя и код игры!");
        return;
    }
    
    if (inputCode.length !== 6) {
        alert("Код игры должен состоять из 6 символов!");
        return;
    }
    
    try {
        if (firebaseReady && database) {
            // Проверяем существование игры в Firebase
            const gameRef = ref(database, `games/${inputCode}`);
            
            onValue(gameRef, (snapshot) => {
                if (!snapshot.exists()) {
                    if (joinStatusElement) {
                        joinStatusElement.textContent = "Игра не найдена!";
                        joinStatusElement.style.color = "#f5576c";
                    }
                    return;
                }
                
                const game = snapshot.val();
                
                if (game.status === "finished") {
                    if (joinStatusElement) {
                        joinStatusElement.textContent = "Игра уже завершена!";
                        joinStatusElement.style.color = "#f5576c";
                    }
                    return;
                }
                
                // Регистрируем игрока (только если еще не регистрируемся)
                if (!isRegisteringPlayer) {
                    currentGameCode = inputCode;
                    playerId = generatePlayerId();
                    
                    registerPlayer(playerName, inputCode);
                }
            }, { once: true });
        } else {
            // Демо-режим: просто регистрируем локально
            console.log("⚠️ Демо-режим: присоединение к игре");
            alert("⚠️ ДЕМО-РЕЖИМ\n\nFirebase не настроен. В демо-режиме можно только просмотреть интерфейс.\nДля реальной игры настройте Firebase.");
            
            currentGameCode = inputCode;
            playerId = generatePlayerId();
            
            // Пробуем зарегистрировать (будет работать только локально)
            await registerPlayer(playerName, inputCode);
        }
        
    } catch (error) {
        console.error("Ошибка присоединения:", error);
        alert("Ошибка присоединения к игре: " + error.message);
    }
}

// Регистрация игрока
async function registerPlayer(playerName, gameCode) {
    // Защита от множественных вызовов
    if (isRegisteringPlayer) {
        console.log("Регистрация игрока уже выполняется, пропускаем повторный вызов");
        return;
    }
    
    isRegisteringPlayer = true;
    
    try {
        // Загружаем данные перед регистрацией
        await loadGameData();
        
        // Проверяем, не зарегистрирован ли уже игрок с таким ID или именем
        if (firebaseReady && database) {
            // Проверяем по ID
            const playerRef = ref(database, `games/${gameCode}/players/${playerId}`);
            const snapshot = await new Promise((resolve) => {
                onValue(playerRef, resolve, { once: true });
            });
            if (snapshot.exists()) {
                console.log("Игрок уже зарегистрирован с таким ID:", playerId);
                // Обновляем localStorage и переходим в игру
                localStorage.setItem('gameData', JSON.stringify({
                    gameCode: gameCode,
                    playerId: playerId,
                    playerName: playerName,
                    isHost: false
                }));
                setTimeout(() => {
                    window.location.href = "game.html";
                }, 500);
                return;
            }
            
            // Проверяем, нет ли уже игрока с таким именем в этой игре
            const playersRef = ref(database, `games/${gameCode}/players`);
            const playersSnapshot = await new Promise((resolve) => {
                onValue(playersRef, resolve, { once: true });
            });
            if (playersSnapshot.exists()) {
                const players = playersSnapshot.val();
                const existingPlayer = Object.values(players).find(p => p.name === playerName);
                if (existingPlayer) {
                    console.log("Игрок с таким именем уже зарегистрирован:", playerName);
                    // Находим ID существующего игрока
                    const existingPlayerId = Object.keys(players).find(id => players[id].name === playerName);
                    if (existingPlayerId) {
                        playerId = existingPlayerId;
                        localStorage.setItem('gameData', JSON.stringify({
                            gameCode: gameCode,
                            playerId: playerId,
                            playerName: playerName,
                            isHost: false
                        }));
                        setTimeout(() => {
                            window.location.href = "game.html";
                        }, 500);
                        return;
                    }
                }
            }
        }
        
        // Генерируем карточки для игрока
        const playerCardsData = {
            name: playerName,
            ministry: getRandomItem(ministries),
            competences: [
                getRandomItem(competences.filter(c => c.type === 'positive')),
                getRandomItem(competences.filter(c => c.type === 'negative'))
            ],
            resources: [getRandomItem(resources)],
            score: 0,
            currentAnswer: "",
            usedCompetence: null,
            usedResource: null,
            joinedAt: Date.now()
        };
        
        if (firebaseReady && database) {
            const playerRef = ref(database, `games/${gameCode}/players/${playerId}`);
            await set(playerRef, playerCardsData);
        } else {
            // Демо-режим: сохраняем карточки локально
            localStorage.setItem('playerCards', JSON.stringify(playerCardsData));
            console.log("⚠️ Демо-режим: карточки сохранены локально");
        }
        
        // Сохраняем данные в localStorage
        localStorage.setItem('gameData', JSON.stringify({
            gameCode: gameCode,
            playerId: playerId,
            playerName: playerName,
            isHost: false
        }));
        
        const joinStatusElement = document.getElementById('joinStatus');
        if (joinStatusElement) {
            joinStatusElement.textContent = "Успешно! Переход в игру...";
            joinStatusElement.style.color = "#43e97b";
        }
        
        // Переходим на игровую страницу через небольшую задержку
        setTimeout(() => {
            window.location.href = "game.html";
        }, 1000);
        
    } catch (error) {
        console.error("Ошибка регистрации игрока:", error);
        alert("Ошибка регистрации игрока: " + error.message);
    } finally {
        // Сбрасываем флаг через небольшую задержку
        setTimeout(() => {
            isRegisteringPlayer = false;
        }, 2000);
    }
}

// Загрузка данных игры
async function loadGameData() {
    try {
        // Пробуем разные пути для совместимости с разными окружениями
        const basePaths = [
            './data/',
            'data/',
            '/data/',
            '../data/'
        ];
        
        let loaded = false;
        let lastError = null;
        
        for (const basePath of basePaths) {
            try {
                const responses = await Promise.all([
                    fetch(`${basePath}ministries.json`),
                    fetch(`${basePath}competences.json`),
                    fetch(`${basePath}resources.json`),
                    fetch(`${basePath}stress-cases.json`),
                    fetch(`${basePath}regular-cases.json`)
                ]);
                
                // Проверяем, что все запросы успешны
                const failed = responses.find(r => !r.ok);
                if (failed) {
                    throw new Error(`Failed to load: ${failed.url}`);
                }
                
                const data = await Promise.all(responses.map(r => r.json()));
                
                ministries = data[0];
                competences = data[1];
                resources = data[2];
                stressCases = data[3];
                regularCases = data[4];
                
                console.log("Данные игры загружены из:", basePath);
                loaded = true;
                break;
            } catch (error) {
                lastError = error;
                console.warn(`Не удалось загрузить из ${basePath}:`, error);
            }
        }
        
        if (!loaded) {
            throw lastError || new Error("Не удалось загрузить данные игры");
        }
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        alert("Ошибка загрузки данных игры. Проверьте наличие файлов в папке data/ и подключение к интернету.\n\nОшибка: " + error.message);
        throw error;
    }
}

// Функции для игрового процесса
function useCompetence(index) {
    if (!playerCards || !playerCards.competences[index]) return;
    
    const competence = playerCards.competences[index];
    
    // Проверяем, не использована ли уже компетенция в текущем раунде
    if (playerCards.usedCompetence && playerCards.usedCompetence.id === competence.id) {
        alert("Эта компетенция уже использована в этом раунде!");
        return;
    }
    
    // Проверяем доступность компетенции (раз в 3 круга)
    const gameRef = ref(database, `games/${currentGameCode}`);
    onValue(gameRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const currentRound = snapshot.val()?.currentRound || 0;
        const usedCompetences = playerCards.usedCompetences || {};
        const compUsage = usedCompetences[competence.id];
        
        if (compUsage && compUsage.lastUsedRound !== undefined) {
            const roundsSinceUse = currentRound - compUsage.lastUsedRound;
            if (roundsSinceUse < 3) {
                alert(`Эта компетенция была использована ${roundsSinceUse} ${roundsSinceUse === 1 ? 'круг' : 'круга'} назад. Можно использовать раз в 3 круга. Доступна через ${3 - roundsSinceUse} ${3 - roundsSinceUse === 1 ? 'круг' : 'круга'}.`);
                return;
            }
        }
        
        selectedCompetence = competence;
        document.getElementById('compBtn').disabled = false;
        
        // Визуально выделяем выбранную карту
        document.querySelectorAll('.competence').forEach((card, i) => {
            if (i === index) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        updateSelectedCards();
    }, { once: true });
}

function useResource(index = 0) {
    if (!playerCards || !playerCards.resources[index]) return;
    
    const resource = playerCards.resources[index];
    
    // Проверяем, не использован ли уже ресурс
    if (playerCards.usedResource && playerCards.usedResource.id === resource.id) {
        alert("Этот ресурс уже использован!");
        return;
    }
    
    selectedResource = resource;
    document.getElementById('resBtn').disabled = false;
    
    // Визуально выделяем выбранную карту
    document.getElementById('resource0').classList.add('selected');
    
    updateSelectedCards();
}

async function submitAnswer() {
    const answer = document.getElementById('answerInput').value.trim();
    
    if (!answer) {
        alert("Введите ваш ответ!");
        return;
    }
    
    // Проверяем обязательное использование компетенции
    if (!selectedCompetence) {
        alert("Вы должны использовать одну из компетенций на каждом этапе!");
        return;
    }
    
    if (!currentGameCode || !playerId) {
        alert("Ошибка: данные игры не найдены!");
        return;
    }
    
    try {
        // Получаем текущий раунд для отслеживания использования компетенций
        const gameRef = ref(database, `games/${currentGameCode}`);
        const gameSnapshot = await new Promise((resolve) => {
            onValue(gameRef, resolve, { once: true });
        });
        const currentRound = gameSnapshot.val()?.currentRound || 0;
        
        const answerData = {
            text: answer,
            competence: selectedCompetence,
            resource: selectedResource,
            timestamp: Date.now(),
            playerId: playerId,
            round: currentRound
        };
        
        // Сохраняем ответ в Firebase
        const answerRef = ref(database, `games/${currentGameCode}/answers/${playerId}`);
        await set(answerRef, answerData);
        
        // Обновляем состояние игрока и записываем раунд использования компетенции
        const playerRef = ref(database, `games/${currentGameCode}/players/${playerId}`);
        const playerSnapshot = await new Promise((resolve) => {
            onValue(playerRef, resolve, { once: true });
        });
        const playerData = playerSnapshot.val() || {};
        
        // Обновляем информацию об использованных компетенциях
        const usedCompetences = playerData.usedCompetences || {};
        usedCompetences[selectedCompetence.id] = {
            lastUsedRound: currentRound,
            competence: selectedCompetence
        };
        
        await update(playerRef, {
            currentAnswer: answer,
            usedCompetence: selectedCompetence,
            usedResource: selectedResource,
            usedCompetences: usedCompetences
        });
        
        // Отключаем кнопку отправки
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('submitBtn').textContent = "Ответ отправлен ✓";
        
        alert("Ответ отправлен ведущему!");
        
    } catch (error) {
        console.error("Ошибка отправки ответа:", error);
        alert("Ошибка отправки ответа.");
    }
}

function useSelectedCompetence() {
    if (!selectedCompetence) return;
    alert(`Использована компетенция: ${selectedCompetence.name}\n${selectedCompetence.description}`);
}

function useSelectedResource() {
    if (!selectedResource) return;
    alert(`Использован ресурс: ${selectedResource.name}\n${selectedResource.description}`);
}

// Функция для ведущего: следующий кейс
async function nextCase() {
    if (!currentGameCode || !isHost) return;
    
    try {
        const gameRef = ref(database, `games/${currentGameCode}`);
        
        // Выбираем случайный кейс (чередуем стрессовые и обычные)
        const allCases = [...stressCases, ...regularCases];
        const randomCase = getRandomItem(allCases);
        
        // Получаем текущий раунд
        const snapshot = await new Promise((resolve) => {
            onValue(gameRef, resolve, { once: true });
        });
        const currentRound = snapshot.val()?.currentRound || 0;
        
        await update(gameRef, {
            currentCase: randomCase,
            currentRound: currentRound + 1,
            answers: {} // Очищаем ответы
        });
        
        // Сбрасываем ответы всех игроков
        const playersRef = ref(database, `games/${currentGameCode}/players`);
        onValue(playersRef, (snapshot) => {
            const players = snapshot.val();
            if (players) {
                Object.keys(players).forEach(playerKey => {
                    const playerRef = ref(database, `games/${currentGameCode}/players/${playerKey}`);
                    update(playerRef, {
                        currentAnswer: "",
                        usedCompetence: null,
                        usedResource: null
                    });
                });
            }
        }, { once: true });
        
        // Очищаем оценки за раунд в ответах
        const answersRef = ref(database, `games/${currentGameCode}/answers`);
        onValue(answersRef, (snapshot) => {
            const answers = snapshot.val();
            if (answers) {
                Object.keys(answers).forEach(answerKey => {
                    const answerRef = ref(database, `games/${currentGameCode}/answers/${answerKey}`);
                    update(answerRef, {
                        roundScore: null
                    });
                });
            }
        }, { once: true });
        
        console.log("Следующий кейс загружен");
        
    } catch (error) {
        console.error("Ошибка загрузки кейса:", error);
        alert("Ошибка загрузки следующего кейса.");
    }
}

// Функция завершения игры
async function endGame() {
    if (!currentGameCode || !isHost) return;
    
    if (!confirm("Вы уверены, что хотите завершить игру?")) return;
    
    try {
        const gameRef = ref(database, `games/${currentGameCode}`);
        await update(gameRef, {
            status: "finished"
        });
        
        // Получаем финальные результаты игроков
        const playersRef = ref(database, `games/${currentGameCode}/players`);
        const playersSnapshot = await new Promise((resolve) => {
            onValue(playersRef, resolve, { once: true });
        });
        
        const players = playersSnapshot.val() || {};
        showFinalLeaderboard(players);
        
    } catch (error) {
        console.error("Ошибка завершения игры:", error);
        alert("Ошибка завершения игры.");
    }
}

// Функция показа финальной таблицы лидеров
function showFinalLeaderboard(players) {
    // Создаем модальное окно с финальной таблицей
    const modal = document.createElement('div');
    modal.className = 'final-leaderboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const playersArray = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    let html = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%;">
            <h2 style="text-align: center; color: #667eea; margin-bottom: 20px;">🏆 Игра завершена!</h2>
            <h3 style="text-align: center; margin-bottom: 20px;">Финальные результаты</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #667eea;">Место</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #667eea;">Игрок</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #667eea;">Баллы</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    playersArray.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        html += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px; font-weight: ${index < 3 ? 'bold' : 'normal'};">${medal}</td>
                <td style="padding: 12px; font-weight: ${index < 3 ? 'bold' : 'normal'};">${player.name || 'Игрок'}</td>
                <td style="padding: 12px; text-align: right; font-weight: ${index < 3 ? 'bold' : 'normal'};">${player.score || 0}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
            <button onclick="this.closest('.final-leaderboard-modal').remove()" 
                    style="width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
                Закрыть
            </button>
        </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

// Вспомогательные функции
function getRandomItem(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function updateSelectedCards() {
    const container = document.getElementById('selectedCards');
    if (!container) return;
    
    let html = '';
    
    if (selectedCompetence) {
        html += `<div class="selected-card">💪 ${selectedCompetence.name}</div>`;
    }
    
    if (selectedResource) {
        html += `<div class="selected-card">🛠️ ${selectedResource.name}</div>`;
    }
    
    container.innerHTML = html;
}

// Функция очистки подписок при выходе со страницы
function cleanupSubscriptions() {
    if (gameValueUnsubscribe) {
        gameValueUnsubscribe();
        gameValueUnsubscribe = null;
    }
    if (playerValueUnsubscribe) {
        playerValueUnsubscribe();
        playerValueUnsubscribe = null;
    }
    isGamePageInitialized = false;
}

// Инициализация при загрузке страницы
window.onload = async function() {
    // Показываем предупреждение о Firebase на главной странице
    if (!window.location.pathname.includes('game.html')) {
        const warningElement = document.getElementById('firebaseWarning');
        if (warningElement && !firebaseReady) {
            warningElement.style.display = 'block';
        }
    }
    
    if (window.location.pathname.includes('game.html')) {
        await initializeGamePage();
    }
};

// Очистка при выходе со страницы
window.addEventListener('beforeunload', cleanupSubscriptions);

// Экспорт функций для использования в HTML
window.createGame = createGame;
window.startGame = startGame;
window.joinGame = joinGame;
window.useCompetence = useCompetence;
window.useResource = useResource;
window.submitAnswer = submitAnswer;
window.useSelectedCompetence = useSelectedCompetence;
window.useSelectedResource = useSelectedResource;
window.nextCase = nextCase;
window.endGame = endGame;

async function initializeGamePage() {
    // Защита от повторной инициализации
    if (isGamePageInitialized) {
        console.log("Страница игры уже инициализирована, пропускаем повторную инициализацию");
        return;
    }
    
    const gameDataStr = localStorage.getItem('gameData');
    if (!gameDataStr) {
        window.location.href = 'index.html';
        return;
    }
    
    const gameData = JSON.parse(gameDataStr);
    currentGameCode = gameData.gameCode;
    playerId = gameData.playerId;
    isHost = gameData.isHost || false;
    
    // Загружаем данные игры с обработкой ошибок
    try {
        await loadGameData();
    } catch (error) {
        console.error("Критическая ошибка загрузки данных:", error);
        // Не прерываем выполнение, но показываем предупреждение
    }
    
    // Отписываемся от предыдущих подписок, если они есть
    if (gameValueUnsubscribe) {
        gameValueUnsubscribe();
        gameValueUnsubscribe = null;
    }
    if (playerValueUnsubscribe) {
        playerValueUnsubscribe();
        playerValueUnsubscribe = null;
    }
    
    // Подписываемся на изменения в игре
    if (firebaseReady && database) {
        const gameRef = ref(database, `games/${currentGameCode}`);
        gameValueUnsubscribe = onValue(gameRef, (snapshot) => {
            if (!snapshot.exists()) {
                alert("Игра не найдена!");
                window.location.href = 'index.html';
                return;
            }
            
            const game = snapshot.val();
            
            // Обновляем интерфейс
            updateGameUI(game);
        });
        
        // Подписываемся на изменения данных игрока (только для обычных игроков, не для ведущего)
        if (!isHost && playerId && playerId !== 'host') {
            const playerRef = ref(database, `games/${currentGameCode}/players/${playerId}`);
            playerValueUnsubscribe = onValue(playerRef, async (snapshot) => {
                if (snapshot.exists()) {
                    playerCards = snapshot.val();
                    await updatePlayerCards();
                }
            });
        }
    }
    
    isGamePageInitialized = true;
    console.log("Страница игры инициализирована. isHost:", isHost, "playerId:", playerId);
}

function updateGameUI(game) {
    // Показываем текущий кейс
    if (game.currentCase) {
        const caseText = document.getElementById('caseText');
        if (caseText) {
            caseText.textContent = game.currentCase.text || game.currentCase.description || "Кейс загружается...";
        }
        
        // Сбрасываем форму ответа для нового кейса (только для игроков, не для ведущего)
        if (!isHost) {
            const answerInput = document.getElementById('answerInput');
            const submitBtn = document.getElementById('submitBtn');
            if (answerInput) answerInput.value = "";
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Отправить ответ";
            }
            
            // Сбрасываем выбранные карты
            selectedCompetence = null;
            selectedResource = null;
            updateSelectedCards();
            if (document.getElementById('compBtn')) document.getElementById('compBtn').disabled = true;
            if (document.getElementById('resBtn')) document.getElementById('resBtn').disabled = true;
        }
    }
    
    // Обновляем таблицу лидеров
    updateLeaderboard(game.players);
    
    // Если мы ведущий, показываем консоль и ответы игроков, скрываем панель игрока и поле ответа
    if (isHost) {
        const hostConsole = document.getElementById('hostConsole');
        if (hostConsole) hostConsole.style.display = 'block';
        
        const playerPanel = document.getElementById('playerPanel');
        if (playerPanel) playerPanel.style.display = 'none';
        
        const answerSection = document.getElementById('answerSection');
        if (answerSection) answerSection.style.display = 'none';
        
        updatePlayerAnswers(game.answers, game.players);
    } else {
        // Для обычных игроков показываем панель и поле ответа
        const playerPanel = document.getElementById('playerPanel');
        if (playerPanel) playerPanel.style.display = 'block';
        
        const answerSection = document.getElementById('answerSection');
        if (answerSection) answerSection.style.display = 'block';
    }
}

async function updatePlayerCards() {
    if (!playerCards) return;
    
    // Обновляем имя игрока
    const playerNameDisplay = document.getElementById('playerNameDisplay');
    if (playerNameDisplay) {
        playerNameDisplay.textContent = playerCards.name || "Игрок";
    }
    
    // Обновляем министерство
    const ministryCard = document.getElementById('ministryCard');
    if (ministryCard && playerCards.ministry) {
        ministryCard.innerHTML = `<div class="card-title">${playerCards.ministry.name}</div>`;
    }
    
    // Получаем текущий раунд для проверки доступности компетенций
    let currentRound = 0;
    if (firebaseReady && database && currentGameCode) {
        try {
            const gameRef = ref(database, `games/${currentGameCode}`);
            const gameSnapshot = await new Promise((resolve) => {
                onValue(gameRef, resolve, { once: true });
            });
            if (gameSnapshot.exists()) {
                currentRound = gameSnapshot.val()?.currentRound || 0;
            }
        } catch (error) {
            console.error("Ошибка получения раунда:", error);
        }
    }
    
    const usedCompetences = playerCards.usedCompetences || {};
    
    // Обновляем компетенции
    if (playerCards.competences) {
        playerCards.competences.forEach((comp, index) => {
            const compCard = document.getElementById(`competence${index}`);
            if (compCard && comp) {
                const typeIcon = comp.type === 'positive' ? '✅' : '⚠️';
                const compUsage = usedCompetences[comp.id];
                
                // Проверяем, можно ли использовать компетенцию (раз в 3 круга)
                let canUse = true;
                let reasonText = '';
                
                if (compUsage && compUsage.lastUsedRound !== undefined) {
                    const roundsSinceUse = currentRound - compUsage.lastUsedRound;
                    if (roundsSinceUse < 3) {
                        canUse = false;
                        reasonText = ` (доступна через ${3 - roundsSinceUse} ${3 - roundsSinceUse === 1 ? 'круг' : 'круга'})`;
                    }
                }
                
                // Помечаем использованные компетенции в текущем раунде
                const isUsedThisRound = playerCards.usedCompetence && playerCards.usedCompetence.id === comp.id;
                
                compCard.innerHTML = `<div class="card-title">${typeIcon} ${comp.name}${reasonText}</div>`;
                
                if (isUsedThisRound) {
                    compCard.classList.add('used');
                    compCard.classList.remove('disabled');
                } else if (!canUse) {
                    compCard.classList.add('disabled');
                    compCard.classList.remove('used');
                } else {
                    compCard.classList.remove('used', 'disabled');
                }
            }
        });
    }
    
    // Обновляем ресурсы
    if (playerCards.resources && playerCards.resources.length > 0) {
        const resourceCard = document.getElementById('resource0');
        if (resourceCard && playerCards.resources[0]) {
            resourceCard.innerHTML = `<div class="card-title">${playerCards.resources[0].name}</div>`;
            
            // Помечаем использованные ресурсы
            if (playerCards.usedResource && playerCards.usedResource.id === playerCards.resources[0].id) {
                resourceCard.classList.add('used');
            } else {
                resourceCard.classList.remove('used');
            }
        }
    }
    
    // Обновляем баллы
    const playerScore = document.getElementById('playerScore');
    if (playerScore) {
        playerScore.textContent = playerCards.score || 0;
    }
}

function updateLeaderboard(players) {
    if (!players) return;
    
    const table = document.getElementById('leaderboardTable');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const playersArray = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    
    playersArray.forEach((player, index) => {
        const row = tbody.insertRow();
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        row.insertCell(0).textContent = `${medal} ${player.name || 'Игрок'}`;
        row.insertCell(1).textContent = player.score || 0;
        
        if (index < 3) {
            row.style.fontWeight = 'bold';
        }
    });
}

function updatePlayerAnswers(answers, players) {
    if (!answers || !players) return;
    
    const container = document.getElementById('playerAnswers');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.keys(answers).forEach(playerId => {
        const answer = answers[playerId];
        const player = players[playerId];
        
        if (!answer || !player) return;
        
        const answerDiv = document.createElement('div');
        answerDiv.className = 'player-answer';
        
        // Получаем текущую оценку за этот раунд (если есть)
        const currentRoundScore = answer.roundScore || null;
        
        let html = `<h5>${player.name || 'Игрок'}</h5>`;
        html += `<p><strong>Ответ:</strong> ${answer.text || 'Нет ответа'}</p>`;
        
        if (answer.competence) {
            html += `<p><strong>Компетенция:</strong> ${answer.competence.name}</p>`;
        }
        
        if (answer.resource) {
            html += `<p><strong>Ресурс:</strong> ${answer.resource.name}</p>`;
        }
        
        // Показываем текущую оценку за раунд, если есть
        if (currentRoundScore !== null) {
            html += `<p><strong>Оценка за раунд:</strong> ${currentRoundScore > 0 ? '+' : ''}${currentRoundScore} баллов</p>`;
        }
        
        // Кнопки для оценки: 0, +1, +2, +3
        html += `<div class="score-buttons">`;
        html += `<button onclick="awardPoints('${playerId}', 0)" class="score-btn ${currentRoundScore === 0 ? 'selected-score' : ''}">0</button> `;
        html += `<button onclick="awardPoints('${playerId}', 1)" class="score-btn ${currentRoundScore === 1 ? 'selected-score' : ''}">+1</button> `;
        html += `<button onclick="awardPoints('${playerId}', 2)" class="score-btn ${currentRoundScore === 2 ? 'selected-score' : ''}">+2</button> `;
        html += `<button onclick="awardPoints('${playerId}', 3)" class="score-btn ${currentRoundScore === 3 ? 'selected-score' : ''}">+3</button>`;
        html += `</div>`;
        
        answerDiv.innerHTML = html;
        container.appendChild(answerDiv);
    });
}

// Функция начисления баллов (для ведущего)
async function awardPoints(targetPlayerId, points) {
    if (!isHost || !currentGameCode) return;
    
    try {
        // Получаем текущий раунд
        const gameRef = ref(database, `games/${currentGameCode}`);
        const gameSnapshot = await new Promise((resolve) => {
            onValue(gameRef, resolve, { once: true });
        });
        const currentRound = gameSnapshot.val()?.currentRound || 0;
        
        // Получаем текущие данные игрока и ответа
        const playerRef = ref(database, `games/${currentGameCode}/players/${targetPlayerId}`);
        const playerSnapshot = await new Promise((resolve) => {
            onValue(playerRef, resolve, { once: true });
        });
        
        const playerData = playerSnapshot.val();
        const currentScore = playerData?.score || 0;
        
        // Получаем ответ игрока
        const answerRef = ref(database, `games/${currentGameCode}/answers/${targetPlayerId}`);
        const answerSnapshot = await new Promise((resolve) => {
            onValue(answerRef, resolve, { once: true });
        });
        const answerData = answerSnapshot.exists() ? answerSnapshot.val() : {};
        
        // Вычисляем предыдущую оценку за этот раунд (если была)
        const previousRoundScore = answerData.roundScore || 0;
        
        // Вычисляем новую оценку: текущий счет - предыдущая оценка за раунд + новая оценка
        const newScore = currentScore - previousRoundScore + points;
        
        // Обновляем счет игрока
        await update(playerRef, {
            score: newScore
        });
        
        // Обновляем оценку за раунд в ответе
        await update(answerRef, {
            roundScore: points,
            scoredAt: Date.now()
        });
        
        console.log(`Установлена оценка ${points} баллов игроку ${targetPlayerId} за раунд ${currentRound}`);
        
    } catch (error) {
        console.error("Ошибка начисления баллов:", error);
        alert("Ошибка начисления баллов.");
    }
}

window.awardPoints = awardPoints;


