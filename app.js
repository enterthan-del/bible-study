// App State
let appData = {
    decks: [],
    settings: {
        theme: 'light'
    }
};

let currentDeckId = null;
let currentStudyCards = [];
let currentStudyIndex = 0;
let isReversed = false;

// DOM Elements
const views = {
    decks: document.getElementById('view-decks'),
    deckDetails: document.getElementById('view-deck-details'),
    study: document.getElementById('view-study')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadData();
    setupEventListeners();
    renderDeckList();
    applyTheme(appData.settings.theme);
});

// ==========================================
// 1. Data Management (LocalStorage)
// ==========================================
function saveData() {
    localStorage.setItem('flashpro_data', JSON.stringify(appData));
}

function loadData() {
    const saved = localStorage.getItem('flashpro_data');
    if (saved) {
        try {
            appData = JSON.parse(saved);
        } catch (e) {
            console.error('Data parsing error', e);
        }
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==========================================
// 2. Event Listeners
// ==========================================
function setupEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // View Navigation
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => switchView('decks'));
    });

    // Modals
    document.getElementById('btnCreateDeck').addEventListener('click', () => openModal('modalCreateDeck'));
    document.getElementById('btnAddCard').addEventListener('click', () => {
        document.getElementById('editCardId').value = '';
        document.getElementById('cardFrontInput').value = '';
        document.getElementById('cardBackInput').value = '';
        document.getElementById('cardReferenceInput').value = '';
        openModal('modalAddCard');
    });
    
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('modalCreateDeck');
            closeModal('modalAddCard');
            closeModal('modalExportPdf');
            closeModal('modalExportCsv');
        });
    });

    // Actions
    document.getElementById('btnConfirmCreateDeck').addEventListener('click', handleCreateDeck);
    document.getElementById('btnConfirmAddCard').addEventListener('click', handleAddCard);
    
    // Study
    document.getElementById('btnStudyDeck').addEventListener('click', startStudySession);
    document.getElementById('btnStudyAllDeck').addEventListener('click', startStudyAllSession);
    document.getElementById('activeFlashcard').addEventListener('click', flipCard);
    document.getElementById('btnShowAnswer').addEventListener('click', showAnswer);
    
    document.querySelectorAll('.srs-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const score = parseInt(e.currentTarget.dataset.score);
            handleSrsAnswer(score);
        });
    });

    document.getElementById('btnToggleReverse').addEventListener('click', toggleReverseMode);
    
    // TTS
    document.querySelector('.tts-front').addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(document.getElementById('cardFrontText').innerText);
    });
    document.querySelector('.tts-back').addEventListener('click', (e) => {
        e.stopPropagation();
        const textToRead = document.getElementById('cardBackText').innerText + " " + document.getElementById('cardReferenceText').innerText.replace('참고 자료:', '');
        speakText(textToRead.trim());
    });

    // CSV & Export/Import
    document.getElementById('csvFileInput').addEventListener('change', handleCsvImport);
    
    document.getElementById('btnExportCsv').addEventListener('click', () => {
        const container = document.getElementById('csvDeckSelection');
        container.innerHTML = '';
        if (appData.decks.length === 0) return container.innerHTML = '<p style="text-align:center;">생성된 덱이 없습니다.</p>';
        appData.decks.forEach(deck => {
            container.innerHTML += `
                <div style="margin-bottom: 8px;">
                    <label style="display:flex; align-items:flex-start; gap: 10px; font-weight: normal; cursor:pointer; color: var(--text-main); text-align: left;">
                        <input type="checkbox" class="csv-deck-cb" value="${deck.id}" checked style="width: 16px; height: 16px; margin-top: 3px; flex-shrink: 0;">
                        <span style="flex: 1; line-height: 1.4; word-break: keep-all; overflow-wrap: break-word;">${deck.name} (${deck.cards.length}장)</span>
                    </label>
                </div>
            `;
        });
        openModal('modalExportCsv');
    });
    document.getElementById('btnConfirmExportCsv').addEventListener('click', handleExportCsvSelected);
    
    document.getElementById('btnExportAll').addEventListener('click', handleExportJson);
    document.getElementById('jsonFileInput').addEventListener('change', handleImportJson);
    
    document.getElementById('btnExportPdf').addEventListener('click', () => {
        const deck = appData.decks.find(d => d.id === currentDeckId);
        document.getElementById('pdfFileNameInput').value = deck ? `${deck.name}_flashcards` : 'flashcards';
        openModal('modalExportPdf');
    });
    document.getElementById('btnConfirmExportPdf').addEventListener('click', handleExportPdf);
}

// ==========================================
// 3. UI Navigation & Rendering
// ==========================================
function switchView(viewId) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    
    if (viewId === 'decks') {
        renderDeckList();
        views.decks.classList.remove('hidden');
        currentDeckId = null;
    } else if (viewId === 'deckDetails') {
        renderDeckDetails();
        views.deckDetails.classList.remove('hidden');
    } else if (viewId === 'study') {
        views.study.classList.remove('hidden');
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function renderDeckList() {
    const container = document.getElementById('deckListContainer');
    container.innerHTML = '';
    
    if (appData.decks.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">아직 생성된 덱이 없습니다. 새 덱을 만들어보세요!</p>';
        return;
    }
    
    appData.decks.forEach(deck => {
        const dueCardsCount = deck.cards.filter(isCardDue).length;
        const totalCards = deck.cards.length;
        
        const el = document.createElement('div');
        el.className = 'deck-card';
        el.innerHTML = `
            <div class="deck-title">${deck.name}</div>
            <div class="deck-info">카드 ${totalCards}장 | <strong>${dueCardsCount}장 학습 필요</strong></div>
            <div class="deck-actions">
                <button class="icon-btn btn-delete-deck" data-id="${deck.id}" aria-label="삭제">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        
        // click to open details
        el.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-deck')) {
                if(confirm('이 덱을 삭제하시겠습니까?')) {
                    appData.decks = appData.decks.filter(d => d.id !== deck.id);
                    saveData();
                    renderDeckList();
                }
                return;
            }
            currentDeckId = deck.id;
            switchView('deckDetails');
        });
        
        container.appendChild(el);
    });
    lucide.createIcons();
}

function renderDeckDetails() {
    const deck = appData.decks.find(d => d.id === currentDeckId);
    if (!deck) return switchView('decks');
    
    document.getElementById('detailDeckTitle').innerText = deck.name;
    
    const dueCards = deck.cards.filter(isCardDue).length;
    const totalCards = deck.cards.length;
    
    let totalCorrect = 0;
    let totalAttempts = 0;
    deck.cards.forEach(c => {
        if (c.stats) {
            totalCorrect += c.stats.correct || 0;
            totalAttempts += (c.stats.correct || 0) + (c.stats.incorrect || 0);
        }
    });
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    
    document.getElementById('statTotalCards').innerText = totalCards;
    document.getElementById('statDueCards').innerText = dueCards;
    document.getElementById('statAccuracy').innerText = `${accuracy}%`;
    
    const container = document.getElementById('cardListContainer');
    container.innerHTML = '';
    
    if (totalCards === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 1rem;">카드가 없습니다. 카드를 추가하거나 CSV로 가져오세요.</p>';
        return;
    }
    
    deck.cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'list-item-card';
        el.innerHTML = `
            <div class="list-item-content">
                <div class="list-item-front">${card.front}</div>
                <div class="list-item-back">${card.back}</div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="icon-btn btn-edit-card" data-id="${card.id}" aria-label="수정">
                    <i data-lucide="edit"></i>
                </button>
                <button class="icon-btn btn-delete-card" data-id="${card.id}" aria-label="삭제">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        el.querySelector('.btn-edit-card').addEventListener('click', () => {
            document.getElementById('editCardId').value = card.id;
            document.getElementById('cardFrontInput').value = card.front;
            document.getElementById('cardBackInput').value = card.back;
            document.getElementById('cardReferenceInput').value = card.reference || '';
            openModal('modalAddCard');
        });
        el.querySelector('.btn-delete-card').addEventListener('click', () => {
            if(confirm('카드를 삭제하시겠습니까?')) {
                deck.cards = deck.cards.filter(c => c.id !== card.id);
                saveData();
                renderDeckDetails();
            }
        });
        container.appendChild(el);
    });
    lucide.createIcons();
}

// ==========================================
// 4. Deck & Card Actions
// ==========================================
function handleCreateDeck() {
    const nameInput = document.getElementById('deckNameInput');
    const name = nameInput.value.trim();
    if (!name) return alert('덱 이름을 입력하세요.');
    
    appData.decks.push({
        id: generateId(),
        name: name,
        createdAt: Date.now(),
        cards: []
    });
    
    saveData();
    nameInput.value = '';
    closeModal('modalCreateDeck');
    renderDeckList();
}

function handleAddCard() {
    const deck = appData.decks.find(d => d.id === currentDeckId);
    if (!deck) return;
    
    const editId = document.getElementById('editCardId').value;
    const front = document.getElementById('cardFrontInput').value.trim();
    const back = document.getElementById('cardBackInput').value.trim();
    const reference = document.getElementById('cardReferenceInput').value.trim();
    
    if (!front || !back) return alert('질문과 정답을 모두 입력하세요.');
    
    if (editId) {
        const cardIndex = deck.cards.findIndex(c => c.id === editId);
        if (cardIndex > -1) {
            deck.cards[cardIndex].front = front;
            deck.cards[cardIndex].back = back;
            deck.cards[cardIndex].reference = reference;
        }
    } else {
        deck.cards.push(createNewCard(front, back, reference));
    }
    
    saveData();
    closeModal('modalAddCard');
    renderDeckDetails();
}

function createNewCard(front, back, reference = '') {
    return {
        id: generateId(),
        front,
        back,
        reference,
        srs: {
            interval: 0,
            repetition: 0,
            easeFactor: 2.5,
            dueDate: Date.now()
        },
        stats: {
            correct: 0,
            incorrect: 0
        }
    };
}

// ==========================================
// 5. Study Mode (SRS logic)
// ==========================================
function isCardDue(card) {
    return card.srs.dueDate <= Date.now();
}

function toggleReverseMode() {
    isReversed = !isReversed;
    document.getElementById('btnToggleReverse').style.color = isReversed ? 'var(--primary)' : 'inherit';
    renderCurrentCard(); // Re-render card with new mode
}

function startStudySession() {
    const deck = appData.decks.find(d => d.id === currentDeckId);
    if (!deck) return;
    
    // Select cards that are due
    currentStudyCards = deck.cards.filter(isCardDue);
    
    if (currentStudyCards.length === 0) {
        return alert('지금 학습할 카드가 없습니다! 훌륭합니다.');
    }
    
    // Shuffle cards
    currentStudyCards.sort(() => Math.random() - 0.5);
    currentStudyIndex = 0;
    isReversed = false;
    document.getElementById('btnToggleReverse').style.color = 'inherit';
    
    switchView('study');
    renderCurrentCard();
}

function startStudyAllSession() {
    const deck = appData.decks.find(d => d.id === currentDeckId);
    if (!deck) return;
    
    currentStudyCards = [...deck.cards];
    
    if (currentStudyCards.length === 0) {
        return alert('학습할 카드가 없습니다.');
    }
    
    // Shuffle cards
    currentStudyCards.sort(() => Math.random() - 0.5);
    currentStudyIndex = 0;
    isReversed = false;
    document.getElementById('btnToggleReverse').style.color = 'inherit';
    
    switchView('study');
    renderCurrentCard();
}

function renderCurrentCard() {
    if (currentStudyIndex >= currentStudyCards.length) {
        alert('학습을 완료했습니다!');
        switchView('deckDetails');
        return;
    }
    
    const card = currentStudyCards[currentStudyIndex];
    const flashcard = document.getElementById('activeFlashcard');
    flashcard.classList.remove('is-flipped');
    
    // Reset controls
    document.getElementById('btnShowAnswer').classList.remove('hidden');
    document.getElementById('srsControls').classList.add('hidden');
    
    // Setup Content based on Reverse mode
    const frontText = isReversed ? card.back : card.front;
    const backText = isReversed ? card.front : card.back;
    
    document.getElementById('cardFrontText').innerText = frontText;
    document.getElementById('cardBackText').innerText = backText;
    
    const refEl = document.getElementById('cardReferenceText');
    if (card.reference && !isReversed) {
        refEl.style.display = 'block';
        // Auto-linkify http references if it starts with http
        if (card.reference.startsWith('http')) {
            refEl.querySelector('span').innerHTML = `<a href="${card.reference}" target="_blank">${card.reference}</a>`;
        } else {
            refEl.querySelector('span').innerText = card.reference;
        }
    } else {
        refEl.style.display = 'none';
    }
    
    // Progress
    const progressText = `${currentStudyIndex + 1} / ${currentStudyCards.length}`;
    document.getElementById('studyProgressText').innerText = progressText;
    
    const progressPercent = ((currentStudyIndex) / currentStudyCards.length) * 100;
    document.getElementById('studyProgressBar').style.width = `${progressPercent}%`;
}

function flipCard() {
    document.getElementById('activeFlashcard').classList.toggle('is-flipped');
}

function showAnswer() {
    document.getElementById('activeFlashcard').classList.add('is-flipped');
    document.getElementById('btnShowAnswer').classList.add('hidden');
    document.getElementById('srsControls').classList.remove('hidden');
}

function handleSrsAnswer(score) {
    const card = currentStudyCards[currentStudyIndex];
    let srs = card.srs;
    let stats = card.stats || { correct: 0, incorrect: 0 };
    
    // Update Stats
    if (score >= 2) stats.correct++;
    else stats.incorrect++;
    card.stats = stats;
    
    // SM-2 Algorithm Implementation
    if (score < 2) {
        srs.repetition = 0;
        srs.interval = 1; // 1 day (or minutes in a real app, keeping it simple to 1 day)
    } else {
        if (srs.repetition === 0) srs.interval = 1;
        else if (srs.repetition === 1) srs.interval = 6;
        else {
            srs.interval = Math.round(srs.interval * srs.easeFactor);
        }
        srs.repetition++;
    }
    
    srs.easeFactor = srs.easeFactor + (0.1 - (3 - score) * (0.08 + (3 - score) * 0.02));
    if (srs.easeFactor < 1.3) srs.easeFactor = 1.3;
    
    // Set next due date (interval is in days, converted to ms)
    srs.dueDate = Date.now() + (srs.interval * 24 * 60 * 60 * 1000);
    
    // Save to global data
    const deck = appData.decks.find(d => d.id === currentDeckId);
    const cardIndexInDeck = deck.cards.findIndex(c => c.id === card.id);
    deck.cards[cardIndexInDeck] = card;
    saveData();
    
    // Next Card
    currentStudyIndex++;
    renderCurrentCard();
}

// ==========================================
// 6. Text-to-Speech (TTS)
// ==========================================
function speakText(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        // Try to auto-detect Korean, but let the browser decide default
        // utterance.lang = 'ko-KR'; 
        window.speechSynthesis.speak(utterance);
    } else {
        alert('이 브라우저는 음성 변환 기능을 지원하지 않습니다.');
    }
}

// ==========================================
// 7. CSV & JSON Export/Import
// ==========================================
function handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
        complete: function(results) {
            const data = results.data;
            if (data.length === 0) return alert('CSV 파일이 비어있습니다.');
            
            const deckName = prompt('가져올 카드를 저장할 덱 이름을 입력하세요:', file.name.replace('.csv', ''));
            if (!deckName) return; // Cancelled
            
            const newDeck = {
                id: generateId(),
                name: deckName,
                createdAt: Date.now(),
                cards: []
            };
            
            // Assume format: Front, Back, Reference(optional)
            data.forEach(row => {
                if (row.length >= 2 && row[0].trim() !== '') {
                    newDeck.cards.push(createNewCard(row[0], row[1], row[2] || ''));
                }
            });
            
            appData.decks.push(newDeck);
            saveData();
            renderDeckList();
            alert(`${newDeck.cards.length}개의 카드를 성공적으로 가져왔습니다.`);
        },
        error: function(error) {
            alert('CSV 파싱 오류: ' + error.message);
        }
    });
    
    e.target.value = ''; // Reset input
}

function handleExportJson() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashpro_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleImportJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData && importedData.decks) {
                if(confirm('기존 데이터를 덮어쓰시겠습니까? (취소하면 병합됩니다)')) {
                    appData = importedData;
                } else {
                    appData.decks = [...appData.decks, ...importedData.decks];
                }
                saveData();
                renderDeckList();
                alert('데이터 복원이 완료되었습니다.');
            } else {
                alert('잘못된 백업 파일 포맷입니다.');
            }
        } catch (error) {
            alert('JSON 파싱 오류: ' + error.message);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
}

// ==========================================
// 8. PDF Export (jsPDF + html2canvas)
// ==========================================
async function handleExportPdf() {
    closeModal('modalExportPdf');
    const deck = appData.decks.find(d => d.id === currentDeckId);
    if (!deck || deck.cards.length === 0) return alert('출력할 카드가 없습니다.');
    
    const layout = document.getElementById('pdfLayoutSelect').value;
    const cardsPerPage = layout === '8' ? 8 : 1;
    
    alert('PDF 생성을 시작합니다. 카드가 많을 경우 시간이 소요될 수 있습니다.');
    const btn = document.getElementById('btnConfirmExportPdf');
    btn.innerText = '생성 중...';
    btn.disabled = true;
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const exportContainer = document.getElementById('pdfExportContainer');
        exportContainer.style.left = '0';
        exportContainer.style.top = '0';
        exportContainer.style.position = 'relative';
        
        const totalChunks = Math.ceil(deck.cards.length / cardsPerPage);
        
        for (let i = 0; i < totalChunks; i++) {
            const chunk = deck.cards.slice(i * cardsPerPage, (i + 1) * cardsPerPage);
            
            const cardStyle8 = `
                background-color: #ffffff; 
                border: 1px solid #e5e7eb; 
                border-radius: 8px; 
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                padding: 1rem;
                color: #1f2937;
                overflow: hidden;
                font-family: 'Inter', -apple-system, sans-serif;
            `;
            const cardStyle1 = `
                background-color: #ffffff; 
                border: 1px solid #e5e7eb; 
                border-radius: 12px; 
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                padding: 2rem;
                color: #1f2937;
                overflow: hidden;
                font-family: 'Inter', -apple-system, sans-serif;
            `;
            
            const frontText8 = `font-size: 8px; font-weight: 500; word-break: keep-all; overflow-wrap: break-word; white-space: pre-wrap; text-align: center; color: #1f2937; line-height: 1.4;`;
            const frontText1 = `font-size: 14px; font-weight: 500; word-break: keep-all; overflow-wrap: break-word; white-space: pre-wrap; text-align: center; color: #1f2937; line-height: 1.4;`;
            
            const backText8 = `font-size: 8px; font-weight: 500; word-break: keep-all; overflow-wrap: break-word; white-space: pre-wrap; text-align: center; color: #4f46e5; line-height: 1.4;`;
            const backText1 = `font-size: 14px; font-weight: 500; word-break: keep-all; overflow-wrap: break-word; white-space: pre-wrap; text-align: center; color: #4f46e5; line-height: 1.4;`;
            
            const refBox8 = `margin-top: 12px; font-size: 6px; padding: 10px; background-color: #e5e7eb; border-radius: 6px; width: 100%; text-align: left; white-space: pre-wrap; font-weight: 400; color: #1f2937; box-sizing: border-box; line-height: 1.4;`;
            const refBox1 = `margin-top: 24px; font-size: 9px; padding: 16px; background-color: #e5e7eb; border-radius: 8px; width: 100%; text-align: left; white-space: pre-wrap; font-weight: 400; color: #1f2937; box-sizing: border-box; line-height: 1.4;`;
            
            // Render Fronts Page
            let frontHtml = `<div class="pdf-card-container" style="width: 595px; min-height: 842px; display: flex; flex-wrap: wrap; align-content: flex-start; padding: 20px; background: #f3f4f6; box-sizing: border-box;">`;
            chunk.forEach(card => {
                if (cardsPerPage === 8) {
                    frontHtml += `
                        <div style="width: calc(50% - 20px); height: 180px; margin: 10px; ${cardStyle8}">
                            <div style="${frontText8}">${card.front}</div>
                        </div>
                    `;
                } else {
                    frontHtml += `
                        <div style="width: 100%; height: 800px; display: flex; align-items: center; justify-content: center;">
                            <div style="width: 500px; height: 350px; ${cardStyle1}">
                                <div style="${frontText1}">${card.front}</div>
                            </div>
                        </div>
                    `;
                }
            });
            frontHtml += `</div>`;
            
            exportContainer.innerHTML = frontHtml;
            let canvas = await html2canvas(exportContainer.querySelector('.pdf-card-container'), { scale: 2 });
            let imgData = canvas.toDataURL('image/jpeg', 0.98);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, (canvas.height * pdfWidth) / canvas.width);
            
            // Render Backs Page
            let backHtml = `<div class="pdf-card-container" style="width: 595px; min-height: 842px; display: flex; flex-wrap: wrap; align-content: flex-start; padding: 20px; background: #f3f4f6; box-sizing: border-box;">`;
            const backChunk = [];
            if (cardsPerPage === 8) {
                for (let j=0; j<chunk.length; j+=2) {
                    backChunk[j] = chunk[j+1];
                    backChunk[j+1] = chunk[j];
                }
            } else {
                backChunk.push(chunk[0]);
            }
            
            backChunk.forEach(card => {
                if(!card) {
                    if (cardsPerPage === 8) {
                        backHtml += `<div style="width: calc(50% - 20px); height: 180px; margin: 10px; box-sizing: border-box;"></div>`;
                    }
                } else {
                    if (cardsPerPage === 8) {
                        backHtml += `
                            <div style="width: calc(50% - 20px); height: 180px; margin: 10px; ${cardStyle8}">
                                <div style="${backText8}">${card.back}</div>
                                ${card.reference ? `<div style="${refBox8}"><strong style="font-weight: 600;">참고 자료:</strong><br>${card.reference}</div>` : ''}
                            </div>
                        `;
                    } else {
                        backHtml += `
                        <div style="width: 100%; height: 800px; display: flex; align-items: center; justify-content: center;">
                            <div style="width: 500px; height: 350px; ${cardStyle1}">
                                <div style="${backText1}">${card.back}</div>
                                ${card.reference ? `<div style="${refBox1}"><strong style="font-weight: 600;">참고 자료:</strong><br>${card.reference}</div>` : ''}
                            </div>
                        </div>
                        `;
                    }
                }
            });
            backHtml += `</div>`;
            
            exportContainer.innerHTML = backHtml;
            canvas = await html2canvas(exportContainer.querySelector('.pdf-card-container'), { scale: 2 });
            imgData = canvas.toDataURL('image/jpeg', 0.98);
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, (canvas.height * pdfWidth) / canvas.width);
        }
        
        const fileNameInput = document.getElementById('pdfFileNameInput').value.trim() || 'flashcards';
        pdf.save(`${fileNameInput}.pdf`);
        
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.innerHTML = '';
        
    } catch (error) {
        console.error(error);
        alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
        btn.innerText = '출력 시작';
        btn.disabled = false;
        lucide.createIcons();
    }
}

function handleExportCsvSelected() {
    const checkboxes = document.querySelectorAll('.csv-deck-cb:checked');
    if (checkboxes.length === 0) return alert('선택된 덱이 없습니다.');
    
    checkboxes.forEach(cb => {
        const deckId = cb.value;
        const deck = appData.decks.find(d => d.id === deckId);
        if (!deck || deck.cards.length === 0) return;
        
        const allCards = [];
        deck.cards.forEach(card => {
            allCards.push({
                "덱 이름": deck.name,
                "질문": card.front,
                "정답": card.back,
                "참고자료": card.reference || ''
            });
        });
        
        const csv = Papa.unparse(allCards);
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.name}_cards.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    closeModal('modalExportCsv');
}

// ==========================================
// 9. Theme Management
// ==========================================
function toggleTheme() {
    const newTheme = appData.settings.theme === 'light' ? 'dark' : 'light';
    appData.settings.theme = newTheme;
    saveData();
    applyTheme(newTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.getElementById('themeIcon').setAttribute('data-lucide', 'sun');
    } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.getElementById('themeIcon').setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}
