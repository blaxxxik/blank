// script.js - Основной функционал приложения поиска

// Глобальные переменные
let currentFile = null;
let searchResults = [];
let fileIndex = [];
let currentMode = 'fast';
let isProcessing = false;
let cancelRequested = false;

// Константы
const MODES = {
    fast: { maxSize: 100 * 1024 * 1024, chunkSize: 1024 * 1024 },
    stream: { maxSize: 500 * 1024 * 1024, chunkSize: 512 * 1024 },
    chunk: { maxSize: 1024 * 1024 * 1024, chunkSize: 256 * 1024 }
};

// Форматирование размера файла
function formatBytes(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Получение информации об использовании памяти
function getMemoryUsage() {
    if (window.performance && window.performance.memory) {
        const used = window.performance.memory.usedJSHeapSize;
        const total = window.performance.memory.totalJSHeapSize;
        const limit = window.performance.memory.jsHeapSizeLimit;
        return {
            used: Math.round(used / 1024 / 1024),
            total: Math.round(total / 1024 / 1024),
            limit: Math.round(limit / 1024 / 1024),
            percent: Math.round((used / limit) * 100)
        };
    }
    return { used: 0, total: 0, limit: 1500, percent: 0 };
}

// Показать сообщение
function showMessage(text, type = 'info') {
    const message = document.getElementById('message');
    if (!message) return;
    
    message.textContent = text;
    message.className = `message ${type} show`;
    
    setTimeout(() => {
        message.classList.remove('show');
    }, 3000);
}

// Рекомендованный режим в зависимости от размера файла
function getRecommendedMode(fileSize) {
    if (fileSize <= MODES.fast.maxSize) return 'fast';
    if (fileSize <= MODES.stream.maxSize) return 'stream';
    return 'chunk';
}

// Чтение чанка как текст
function readChunkAsText(chunk) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(chunk, 'UTF-8');
    });
}

// Создание индекса файла для быстрого поиска
async function createFileIndex(file, mode) {
    fileIndex = [];
    let lineNumber = 1;
    let processedBytes = 0;
    const chunkSize = MODES[mode].chunkSize;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const processedLines = document.getElementById('processedLines');
    
    for (let i = 0; i < totalChunks; i++) {
        if (cancelRequested) {
            showMessage('Обработка отменена', 'error');
            return false;
        }
        
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const chunkText = await readChunkAsText(chunk);
        const lines = chunkText.split('\n');
        
        // Сохраняем информацию о каждой строке
        for (let j = 0; j < lines.length; j++) {
            fileIndex.push({
                number: lineNumber++,
                startByte: start,
                chunkIndex: i,
                lineIndex: j
            });
        }
        
        processedBytes += chunkSize;
        
        // Обновляем прогресс
        if (progressFill && progressPercent && processedLines) {
            const percent = Math.round((processedBytes / file.size) * 100);
            progressFill.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
            processedLines.textContent = (lineNumber - 1).toLocaleString();
        }
        
        // Даем браузеру перерисовать
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Проверяем память каждые 10 чанков
        if (i % 10 === 0) {
            updateMemoryInfo();
            if (getMemoryUsage().percent > 85) {
                showMessage('Мало памяти! Останавливаю обработку...', 'error');
                return false;
            }
        }
    }
    
    return true;
}

// Поиск в файле
async function searchInFile(searchTerm) {
    if (!currentFile || fileIndex.length === 0) {
        showMessage('Файл не загружен', 'error');
        return [];
    }
    
    const results = [];
    const termLower = searchTerm.toLowerCase();
    const chunkSize = MODES[currentMode].chunkSize;
    let chunksProcessed = new Set();
    
    // Ищем по индексу
    for (const item of fileIndex) {
        if (cancelRequested) break;
        
        // Загружаем чанк если еще не загружен
        if (!chunksProcessed.has(item.chunkIndex)) {
            const start = item.chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, currentFile.size);
            const chunk = currentFile.slice(start, end);
            const chunkText = await readChunkAsText(chunk);
            
            // Кэшируем чанк
            chunksProcessed.add(item.chunkIndex);
            window[`chunk_${item.chunkIndex}`] = chunkText;
        }
        
        // Получаем строку из кэша
        const chunkText = window[`chunk_${item.chunkIndex}`];
        const lines = chunkText.split('\n');
        const line = lines[item.lineIndex];
        
        if (line && line.toLowerCase().includes(termLower)) {
            const positions = [];
            let pos = line.toLowerCase().indexOf(termLower);
            while (pos !== -1) {
                positions.push(pos);
                pos = line.toLowerCase().indexOf(termLower, pos + 1);
            }
            
            results.push({
                lineNumber: item.number,
                content: line,
                searchTerm: searchTerm,
                positions: positions,
                chunkIndex: item.chunkIndex,
                lineIndex: item.lineIndex
            });
        }
        
        // Ограничиваем количество результатов для производительности
        if (results.length >= 1000) {
            showMessage('Показаны первые 1000 результатов', 'warning');
            break;
        }
        
        // Даем браузеру перерисовать каждые 100 строк
        if (results.length % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Очищаем кэш чанков
    chunksProcessed.forEach(index => {
        delete window[`chunk_${index}`];
    });
    
    return results;
}

// Обработка загрузки файла
async function handleFileUpload(file) {
    // Сброс
    cancelRequested = false;
    isProcessing = true;
    currentFile = file;
    
    // Проверка размера
    if (file.size > MODES.chunk.maxSize) {
        showMessage(`Файл слишком большой. Максимальный размер: 1 ГБ`, 'error');
        return;
    }
    
    // Определение режима
    const recommendedMode = getRecommendedMode(file.size);
    setMode(recommendedMode);
    
    // Показываем предупреждение для больших файлов
    const largeFileWarning = document.getElementById('largeFileWarning');
    if (largeFileWarning && file.size > MODES.fast.maxSize) {
        largeFileWarning.style.display = 'block';
    }
    
    // Показываем прогресс
    const uploadProgress = document.getElementById('uploadProgress');
    const fileInfo = document.getElementById('fileInfo');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const loadedSize = document.getElementById('loadedSize');
    const totalSize = document.getElementById('totalSize');
    
    if (uploadProgress) uploadProgress.style.display = 'block';
    if (fileInfo) fileInfo.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (loadedSize) loadedSize.textContent = '0 Б';
    if (totalSize) totalSize.textContent = formatBytes(file.size);
    
    // Создаем индекс файла
    showMessage('Создание индекса файла...', 'info');
    const indexCreated = await createFileIndex(file, currentMode);
    
    if (!indexCreated || cancelRequested) {
        if (uploadProgress) uploadProgress.style.display = 'none';
        isProcessing = false;
        return;
    }
    
    // Обновляем информацию
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (fileInfo) {
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `
            <div style="color: #ffffff; font-weight: 600; font-size: 1.2rem; margin-bottom: 10px;">
                ${file.name}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                <div style="background: rgba(138, 138, 255, 0.1); padding: 10px; border-radius: 8px;">
                    <div style="color: #a3a3ff; font-size: 0.9rem;">Размер</div>
                    <div style="color: #ffffff; font-weight: 600;">${formatBytes(file.size)}</div>
                </div>
                <div style="background: rgba(138, 138, 255, 0.1); padding: 10px; border-radius: 8px;">
                    <div style="color: #a3a3ff; font-size: 0.9rem;">Строк</div>
                    <div style="color: #ffffff; font-weight: 600;">${fileIndex.length.toLocaleString()}</div>
                </div>
            </div>
            <div style="color: #8a8aff; font-size: 0.9rem; padding: 10px; background: rgba(138, 138, 255, 0.1); border-radius: 8px;">
                <span>Режим:</span> ${currentMode === 'fast' ? '⚡ Быстрый' : currentMode === 'stream' ? '🔄 Потоковый' : '🧩 По частям'}
            </div>
        `;
    }
    
    // Включаем элементы управления
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    
    if (searchInput) searchInput.disabled = false;
    if (searchBtn) searchBtn.disabled = false;
    if (copyAllBtn) copyAllBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;
    
    showMessage(`Файл "${file.name}" успешно загружен!`, 'success');
    isProcessing = false;
    
    // Обновляем информацию о памяти
    updateMemoryInfo();
}

// Установка режима
function setMode(mode) {
    currentMode = mode;
    
    // Обновляем кнопки
    const modeFast = document.getElementById('modeFast');
    const modeStream = document.getElementById('modeStream');
    const modeChunk = document.getElementById('modeChunk');
    const recommendedMode = document.getElementById('recommendedMode');
    
    if (modeFast) modeFast.classList.remove('active');
    if (modeStream) modeStream.classList.remove('active');
    if (modeChunk) modeChunk.classList.remove('active');
    
    const modeBtn = document.getElementById(`mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if (modeBtn) modeBtn.classList.add('active');
    
    // Обновляем рекомендованный режим
    if (recommendedMode && currentFile) {
        const recommended = getRecommendedMode(currentFile.size);
        recommendedMode.textContent = recommended === mode ? 'Выбран' : recommended;
    }
}

// Обновление информации о памяти
function updateMemoryInfo() {
    const memoryUsage = document.getElementById('memoryUsage');
    const memoryInfo = document.getElementById('memoryInfo');
    
    if (!memoryUsage || !memoryInfo) return;
    
    const mem = getMemoryUsage();
    memoryUsage.textContent = `${mem.used} МБ (${mem.percent}%)`;
    
    if (mem.percent > 80) {
        memoryInfo.style.color = '#ff6b6b';
    } else if (mem.percent > 60) {
        memoryInfo.style.color = '#ffc107';
    } else {
        memoryInfo.style.color = '#a3a3ff';
    }
}

// Поиск
async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (!searchInput || !searchBtn) return;
    
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        showMessage('Введите слово для поиска', 'warning');
        return;
    }
    
    if (!currentFile) {
        showMessage('Сначала загрузите файл', 'warning');
        return;
    }
    
    // Блокируем кнопку
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<div class="loader" style="width: 20px; height: 20px;"></div>';
    
    // Выполняем поиск
    const startTime = Date.now();
    searchResults = await searchInFile(searchTerm);
    const searchTime = Date.now() - startTime;
    
    // Обновляем счетчик
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) resultsCount.textContent = searchResults.length;
    
    // Отображаем результаты
    displayResults();
    
    // Разблокируем кнопку
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<span>Поиск</span><span>🔍</span>';
    
    // Показываем статистику
    showMessage(`Найдено ${searchResults.length} совпадений за ${searchTime}мс`, 'success');
}

// Отображение результатов
function displayResults() {
    const resultsContainer = document.getElementById('resultsContainer');
    const searchInput = document.getElementById('searchInput');
    
    if (!resultsContainer || !searchInput) return;
    
    if (searchResults.length === 0) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #a3a3ff;">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                <p style="font-size: 1.2rem; margin-bottom: 10px;">
                    По запросу "<span style="color: #8a8aff;">${searchInput.value}</span>" ничего не найдено
                </p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    for (let i = 0; i < Math.min(searchResults.length, 100); i++) {
        const result = searchResults[i];
        let highlightedContent = result.content;
        
        // Подсветка найденных слов
        result.positions.sort((a, b) => b - a).forEach(pos => {
            const end = pos + result.searchTerm.length;
            highlightedContent = 
                highlightedContent.substring(0, pos) +
                `<mark style="background: #ffeb3b; color: #000; padding: 2px 4px; border-radius: 3px;">${highlightedContent.substring(pos, end)}</mark>` +
                highlightedContent.substring(end);
        });
        
        html += `
            <div class="result-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: linear-gradient(135deg, #8a8aff 0%, #6464ff 100%); color: white; padding: 6px 15px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                            Строка #${result.lineNumber}
                        </span>
                        <span style="color: #a3a3ff; font-size: 0.9rem;">
                            ${result.positions.length} вхождений
                        </span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="copy-line" data-line="${result.lineNumber}" data-content="${result.content.replace(/"/g, '&quot;')}" style="background: rgba(138, 138, 255, 0.1); border: 1px solid rgba(138, 138, 255, 0.3); color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                            📋 Копировать
                        </button>
                    </div>
                </div>
                <div style="color: #ffffff; font-family: monospace; background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 10px; white-space: pre-wrap; word-break: break-all;">
                    ${highlightedContent}
                </div>
            </div>
        `;
    }
    
    // Добавляем сообщение если результатов больше 100
    if (searchResults.length > 100) {
        html += `
            <div style="text-align: center; padding: 20px; color: #ffc107;">
                <span>⚠️ Показаны первые 100 из ${searchResults.length} результатов</span>
                <div style="margin-top: 10px;">
                    <button id="loadMoreBtn" style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); color: #ffc107; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                        Загрузить еще 100
                    </button>
                </div>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = html;
    
    // Добавляем обработчики для кнопок копирования
    resultsContainer.querySelectorAll('.copy-line').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const line = e.target.dataset.line;
            const content = e.target.dataset.content;
            navigator.clipboard.writeText(content);
            showMessage(`Строка ${line} скопирована!`, 'success');
        });
    });
    
    // Обработчик для кнопки "Загрузить еще"
    if (searchResults.length > 100) {
        document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
            showMessage('Функция в разработке', 'info');
        });
    }
}

// Копирование всех результатов
async function copyAllResults() {
    if (searchResults.length === 0) {
        showMessage('Нет результатов для копирования', 'warning');
        return;
    }
    
    const searchInput = document.getElementById('searchInput');
    if (!searchInput || !currentFile) return;
    
    let text = `Результаты поиска: "${searchInput.value}"\n`;
    text += `Файл: ${currentFile.name}\n`;
    text += `Найдено: ${searchResults.length} совпадений\n\n`;
    
    // Ограничиваем количество копируемых строк
    const limit = Math.min(searchResults.length, 100);
    for (let i = 0; i < limit; i++) {
        const result = searchResults[i];
        text += `[Строка ${result.lineNumber}]: ${result.content}\n`;
    }
    
    if (searchResults.length > 100) {
        text += `\n... и еще ${searchResults.length - 100} результатов\n`;
    }
    
    await navigator.clipboard.writeText(text);
    showMessage(`${limit} строк скопированы!`, 'success');
}

// Экспорт результатов
function exportResults() {
    if (searchResults.length === 0) {
        showMessage('Нет результатов для экспорта', 'warning');
        return;
    }
    
    const searchInput = document.getElementById('searchInput');
    if (!searchInput || !currentFile) return;
    
    let content = `Результаты поиска: "${searchInput.value}"\n`;
    content += `Файл: ${currentFile.name}\n`;
    content += `Время экспорта: ${new Date().toLocaleString()}\n`;
    content += `Найдено: ${searchResults.length} совпадений\n\n`;
    
    searchResults.forEach(result => {
        content += `[Строка ${result.lineNumber}]: ${result.content}\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_results_${currentFile.name}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(`Результаты экспортированы!`, 'success');
}

// Очистка результатов
function clearResults() {
    searchResults = [];
    
    const searchInput = document.getElementById('searchInput');
    const resultsCount = document.getElementById('resultsCount');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (searchInput) searchInput.value = '';
    if (resultsCount) resultsCount.textContent = '0';
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #a3a3ff;">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                <p style="font-size: 1.2rem; margin-bottom: 10px;">
                    Загрузите файл и начните поиск
                </p>
                <p style="opacity: 0.7;">
                    Результаты появятся здесь
                </p>
            </div>
        `;
    }
    
    showMessage('Результаты очищены', 'info');
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Регулярное обновление информации о памяти
    setInterval(updateMemoryInfo, 2000);
    
    // Режимы загрузки
    const modeFast = document.getElementById('modeFast');
    const modeStream = document.getElementById('modeStream');
    const modeChunk = document.getElementById('modeChunk');
    
    if (modeFast) modeFast.addEventListener('click', () => setMode('fast'));
    if (modeStream) modeStream.addEventListener('click', () => setMode('stream'));
    if (modeChunk) modeChunk.addEventListener('click', () => setMode('chunk'));
    
    // Drag and drop для файлов
    const fileDropArea = document.getElementById('fileDropArea');
    const fileInput = document.getElementById('fileInput');
    
    if (fileDropArea) {
        fileDropArea.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        
        fileDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropArea.style.borderColor = '#8a8aff';
            fileDropArea.style.background = 'rgba(138, 138, 255, 0.1)';
        });
        
        fileDropArea.addEventListener('dragleave', () => {
            fileDropArea.style.borderColor = '';
            fileDropArea.style.background = '';
        });
        
        fileDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropArea.style.borderColor = '';
            fileDropArea.style.background = '';
            
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }
    
    // Загрузка файла
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }
    
    // Кнопка отмены
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            cancelRequested = true;
        });
    }
    
    // Поиск
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Действия
    const clearBtn = document.getElementById('clearBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    
    if (clearBtn) clearBtn.addEventListener('click', clearResults);
    if (copyAllBtn) copyAllBtn.addEventListener('click', copyAllResults);
    if (exportBtn) exportBtn.addEventListener('click', exportResults);
});

// Экспортируем функции для использования в других файлах (если нужно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatBytes,
        getMemoryUsage,
        showMessage,
        getRecommendedMode,
        setMode,
        updateMemoryInfo,
        performSearch,
        clearResults,
        copyAllResults,
        exportResults
    };
}
