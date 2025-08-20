// This file will contain all functions that directly interact with the DOM (the "View")
// and all DOM element selections.

// --- DOM Element Selectors ---
export const elements = {
    setupContainer: document.getElementById('setup-container'),
    gameContainer: document.querySelector('.game-container'),
    startGameButton: document.getElementById('start-game-button'),
    playerInputs: [
        document.getElementById('p1-name'),
        document.getElementById('p2-name'),
        document.getElementById('p3-name'),
        document.getElementById('p4-name')
    ],
    statusMessage: document.getElementById('status-message'),
    babuInstructionPanel: document.getElementById('babu-instruction-panel'),
    instructChorButton: document.getElementById('instruct-chor-button'),
    instructDakatButton: document.getElementById('instruct-dakat-button'),
    actionButton: document.getElementById('action-button'),
    playerCards: document.querySelectorAll('.player-card'),
    playerDisplayNames: document.querySelectorAll('.player-name'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalContent: document.getElementById('modal-content'),
    modalScoreboardGrid: document.getElementById('modal-scoreboard-grid'),
    nextRoundButton: document.getElementById('next-round-button'),
    winnerBanner: document.getElementById('winner-banner'),
    persistentScoreboard: document.getElementById('persistent-scoreboard'),
    howToPlayButton: document.getElementById('how-to-play-button'),
    rulesModalOverlay: document.getElementById('rules-modal-overlay'),
    closeRulesButton: document.getElementById('close-rules-button')
};

export const sounds = {
    click: document.getElementById('sound-click'),
    deal: document.getElementById('sound-deal'),
    flip: document.getElementById('sound-flip'),
    correct: document.getElementById('sound-correct'),
    wrong: document.getElementById('sound-wrong'),
    win: document.getElementById('sound-win'),
    ambient: document.getElementById('sound-ambient')
};

// --- UI Update Functions ---

export function playSound(sound) {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.error(`Audio play failed for ${sound.id}: ${error}`));
    }
}

export function updateStatusMessage(newMessage) {
    elements.statusMessage.classList.remove('animate-update');
    void elements.statusMessage.offsetWidth; // Trigger reflow to restart animation
    elements.statusMessage.textContent = newMessage;
    elements.statusMessage.classList.add('animate-update');
}

// ... other UI functions like resetCards, showBabuInstructions, showGameOverModal etc. would go here