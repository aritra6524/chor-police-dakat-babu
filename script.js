document.addEventListener('DOMContentLoaded', () => {
    const roles = [
        { name: 'Babu', points: 1000, icon: '👑' },
        { name: 'Dakat', points: 800, icon: '🔥' },
        { name: 'Police', points: 500, icon: '🛡️' },
        { name: 'Chor', points: 0, icon: '🎭' }
    ];

    // Animate title on load
    const setupTitle = document.querySelector('#setup-container h1');
    if (setupTitle) {
        setupTitle.innerHTML = setupTitle.textContent.split('').map((letter, i) =>
            `<span class="title-letter" style="animation-delay: ${i * 50}ms">${letter === ' ' ? '&nbsp;' : letter}</span>`).join('');
    }

    const setupContainer = document.getElementById('setup-container');
    const gameContainer = document.querySelector('.game-container');
    const startGameButton = document.getElementById('start-game-button');
    const playerInputs = [
        document.getElementById('p1-name'),
        document.getElementById('p2-name'),
        document.getElementById('p3-name'),
        document.getElementById('p4-name')
    ];

    const statusMessage = document.getElementById('status-message');
    const babuInstructionPanel = document.getElementById('babu-instruction-panel');
    const instructChorButton = document.getElementById('instruct-chor-button');
    const instructDakatButton = document.getElementById('instruct-dakat-button');
    const actionButton = document.getElementById('action-button');
    const gameBoard = document.getElementById('game-board');
    const playerCards = document.querySelectorAll('.player-card');
    const playerDisplayNames = document.querySelectorAll('.player-name');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalScoreboardGrid = document.getElementById('modal-scoreboard-grid');
    const nextRoundButton = document.getElementById('next-round-button');
    const winnerBanner = document.getElementById('winner-banner');
    const persistentScoreboard = document.getElementById('persistent-scoreboard');
    const howToPlayButton = document.getElementById('how-to-play-button');
    const rulesModalOverlay = document.getElementById('rules-modal-overlay');
    const rulesModalContent = document.getElementById('rules-modal-content');
    const closeRulesButton = document.getElementById('close-rules-button');

    const sounds = {
        click: document.getElementById('sound-click'),
        deal: document.getElementById('sound-deal'),
        flip: document.getElementById('sound-flip'),
        correct: document.getElementById('sound-correct'),
        wrong: document.getElementById('sound-wrong'),
        win: document.getElementById('sound-win'),
        ambient: document.getElementById('sound-ambient')
    };


    let players = [];
    let playerRoles = [];
    let targetRoleName = null;
    let roundNumber = 0;
    const MAX_ROUNDS = 5;
    let gameState = 'SETUP'; // SETUP, INITIAL, BABU_INSTRUCTS, POLICE_GUESS, ROUND_OVER, GAME_OVER

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function playSound(sound) {
        if (sound) {
            sound.currentTime = 0; // Rewind to the start
            // The play() method returns a Promise which can be useful for handling errors
            sound.play().catch(error => console.error(`Audio play failed for ${sound.id}: ${error}`));
        }
    }

    function initializeGame() {
        // Play ambient music. It will loop automatically.
        if (sounds.ambient) {
            sounds.ambient.volume = 0.3; // Lower volume for background music
            sounds.ambient.play().catch(error => {
                // Autoplay is often blocked by browsers until a user interaction.
                // This is fine since initializeGame is called on a button click.
                console.error(`Ambient audio play failed: ${error}`);
            });
        }
        players = playerInputs.map((input, index) => ({
            name: input.value.trim() || `Player ${index + 1}`,
            score: 0,
            lastRoundScore: 0
        }));

        setupContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameContainer.classList.add('animate-fade-in');

        playerDisplayNames.forEach((nameEl, index) => {
            nameEl.textContent = players[index].name;
        });

        gameState = 'INITIAL';
        updatePersistentScoreboard();
        actionButton.classList.add('is-waiting');
        updateStatusMessage('The stage is set. Begin the round when ready.');
    }

    function updatePersistentScoreboard() {
        let scoreboardHTML = '';
        // Sort by score to show rank implicitly
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        sortedPlayers.forEach(player => {
            scoreboardHTML += `<div class="score-entry"><strong>${player.name}:</strong> ${player.score} pts</div>`;
        });
        persistentScoreboard.innerHTML = scoreboardHTML;
    }

    function updateStatusMessage(newMessage) {
        statusMessage.classList.remove('animate-update');
        void statusMessage.offsetWidth; // Trigger reflow to restart animation
        statusMessage.textContent = newMessage;
        statusMessage.classList.add('animate-update');
    }

    function resetCards() {
        playerCards.forEach((card, index) => {
            card.classList.remove(
                'flipped',
                'is-clickable',
                'is-waiting-for-guess',
                'animate-deal',
                'animate-shake',
                'animate-correct',
                'babu-reveal',
                'police-reveal'
            );
            const cardBack = card.querySelector('.card-back');
            cardBack.className = 'card-back'; // Reset classes
        });
    }

    function setActivePlayer(activeIndex) {
        document.querySelectorAll('.player-area').forEach((area, index) => {
            area.classList.toggle('is-active', index === activeIndex);
        });
    }

    function startRound() {
        roundNumber++;
        resetCards();
        playerRoles = shuffle([...roles]);

        playerCards.forEach((card, index) => {
            // Hide card initially to animate it in
            card.style.opacity = '0';
            const role = playerRoles[index];
            const cardBack = card.querySelector('.card-back');
            cardBack.querySelector('.icon').textContent = role.icon;
            cardBack.querySelector('.role').textContent = role.name;
            cardBack.querySelector('.points').textContent = `${role.points} pts`;
            cardBack.classList.add(role.name.toLowerCase());

            // Staggered dealing animation
            setTimeout(() => {
                card.style.opacity = '1';
                card.classList.add('animate-deal');
                playSound(sounds.deal);
            }, 150 * (index + 1));
        });

        actionButton.classList.add('hidden');
        // Wait for the card dealing animation to complete before flipping the Babu's card.
        // This ensures the flip animation is visible.
        const dealTime = 150 * playerCards.length + 400; // Staggered deal time + buffer
        setTimeout(promptBabuToInstruct, dealTime);
    }

    function promptBabuToInstruct() {
        gameState = 'BABU_INSTRUCTS';
        const babuIndex = playerRoles.findIndex(r => r.name === 'Babu');
        const babuName = players[babuIndex].name;

        setActivePlayer(babuIndex);
        // Flip Babu's card immediately
        playerCards[babuIndex].classList.add('flipped', 'babu-reveal');
        playSound(sounds.flip);
        updateStatusMessage(`A royal decree! ${babuName}, the Babu, must secretly command the Police.`);
        babuInstructionPanel.classList.remove('hidden');
    }

    function handleBabuInstruction(target) {
        if (gameState !== 'BABU_INSTRUCTS') return;

        targetRoleName = target;
        babuInstructionPanel.classList.add('hidden');
        revealRoles();
    }
    function revealRoles() {
        const policeIndex = playerRoles.findIndex(r => r.name === 'Police');

        updateStatusMessage(`The order is given! The loyal Police is revealed...`);

        // Flip Police's card
        setTimeout(() => {
            playerCards[policeIndex].classList.add('flipped', 'police-reveal');
            playSound(sounds.flip);
            setActivePlayer(policeIndex);
            promptPoliceToGuess(policeIndex);
        }, 1500);
    }

    function promptPoliceToGuess(policeIndex) {
        gameState = 'POLICE_GUESS';
        actionButton.classList.add('hidden');
        const policeName = players[policeIndex].name;
        updateStatusMessage(`${policeName}, your orders are clear: Unmask the ${targetRoleName}!`);


        playerCards.forEach((card, index) => {
            if (!card.classList.contains('flipped')) {
                card.classList.add('is-clickable', 'is-waiting-for-guess');
                card.addEventListener('click', handleGuess);
            }
        });
    }

    function handleGuess(event) {
        // Prevent clicking on already flipped cards
        if (gameState !== 'POLICE_GUESS') return;

        const guessedCard = event.currentTarget;
        const guessedIndex = Array.from(playerCards).indexOf(guessedCard);

        // Disable further clicks
        playerCards.forEach(card => {
            card.classList.remove('is-clickable', 'is-waiting-for-guess');
            card.removeEventListener('click', handleGuess); // This is important
        });

        const targetIndex = playerRoles.findIndex(r => r.name === targetRoleName);
        const policeIndex = playerRoles.findIndex(r => r.name === 'Police');
        const chorIndex = playerRoles.findIndex(r => r.name === 'Chor');
        const targetPlayerName = players[targetIndex].name;

        // Animate the guess
        if (guessedIndex === targetIndex) {
            guessedCard.classList.add('animate-correct');
            playSound(sounds.correct);
            // Celebrate the correct guess!
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    zIndex: 1001
                });
            }
        } else {
            guessedCard.classList.add('animate-shake');
            playSound(sounds.wrong);
        }

        const policeBasePoints = roles.find(r => r.name === 'Police').points;
        let roundScores = playerRoles.map(r => r.points);

        if (guessedIndex === targetIndex) {
            // Correct Guess
            let message = `Justice is served! ${targetPlayerName} was the ${targetRoleName}.`;
            roundScores[targetIndex] = 0; // The caught person gets 0.

            // If Dakat was the target and was found, the Chor escapes and gets points.
            if (targetRoleName === 'Dakat') {
                message += ` The Chor slipped away in the chaos!`;
                roundScores[chorIndex] = policeBasePoints;
            }
            updateStatusMessage(message);
        } else {
            // Incorrect Guess
            updateStatusMessage(`A costly mistake! The ${targetRoleName} has escaped justice.`);
            // The target who escaped gets their own points PLUS the Police's points.
            roundScores[targetIndex] += policeBasePoints;
            roundScores[policeIndex] = 0; // Police gets 0 for failing.
        }

        // Update main scores
        for (let i = 0; i < players.length; i++) {
            players[i].lastRoundScore = roundScores[i];
            players[i].score += players[i].lastRoundScore;
        }
        updatePersistentScoreboard();

        // Reveal all cards
        setTimeout(() => {
            revealAllCards(roundScores);
        }, 1000);
    }

    function revealAllCards(roundScores) {
        setActivePlayer(-1); // Clear active player highlight
        let cardsToFlip = [];
        playerCards.forEach((card, index) => {
            if (!card.classList.contains('flipped')) {
                cardsToFlip.push({ card, index });
            }
        });

        let lastFlipDelay = 0;
        cardsToFlip.forEach(({ card, index }, i) => {
            const delay = i * 200;
            lastFlipDelay = delay;
            setTimeout(() => {
                const pointsSpan = card.querySelector('.card-back .points');
                const originalPoints = playerRoles[index].points;
                const finalPoints = roundScores[index];
                if (originalPoints !== finalPoints) {
                    pointsSpan.innerHTML = `<del>${originalPoints}</del> &rarr; ${finalPoints} pts`;
                } else {
                    pointsSpan.textContent = `${finalPoints} pts`;
                }
                card.classList.add('flipped');
                playSound(sounds.flip);
            }, delay);
        });

        setTimeout(() => {
            gameState = 'ROUND_OVER';
            showDetailedScoreboardModal(); // Show the new modal
        // Wait 1.5s after the *last* card starts flipping
        }, 1500 + lastFlipDelay);
    }

    function showDetailedScoreboardModal() {
        modalOverlay.classList.remove('hidden');
        winnerBanner.classList.add('hidden'); // Hide winner banner during round results
        modalContent.classList.add('animate-slide-in');

        // Reset podium styles from a potential previous game over
        modalScoreboardGrid.classList.remove('is-podium');
        modalScoreboardGrid.style.gridTemplateColumns = '2fr 1.5fr 1.5fr 1.5fr';

        modalTitle.textContent = `Round ${roundNumber} of ${MAX_ROUNDS} Results`;

        if (roundNumber >= MAX_ROUNDS) {
            nextRoundButton.textContent = 'Show Final Results';
            nextRoundButton.classList.add('is-waiting');
        } else {
            nextRoundButton.textContent = 'Play Next Round';
            nextRoundButton.classList.add('is-waiting');
        }

        let gridHTML = `
            <div class="header">Player</div>
            <div class="header">Role</div>
            <div class="header score-value">Round Points</div>
            <div class="header score-value">New Total</div>
        `;

        players.forEach((player, index) => {
            const role = playerRoles[index];
            const roundPoints = player.lastRoundScore;
            const sign = roundPoints >= 0 ? '+' : '';

            gridHTML += `
                <div class="player-name-cell">${player.name}</div>
                <div>${role.icon} ${role.name}</div>
                <div class="score-value animate-pop" style="animation-delay: ${100 * index}ms">${sign}${roundPoints}</div>
                <div class="score-value animate-pop" style="animation-delay: ${100 * index + 50}ms">${player.score}</div>
            `;
        });
        modalScoreboardGrid.innerHTML = gridHTML;
    }

    function getOrdinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function celebrateWinner() {
        playSound(sounds.win);
        // A more grand confetti celebration
        const end = Date.now() + (3 * 1000);
        const colors = ['#d4af37', '#ffd700', '#f1c40f', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors,
                zIndex: 1001
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors,
                zIndex: 1001
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }

    function showGameOverModal() {
        gameState = 'GAME_OVER';
        modalTitle.textContent = 'Final Results!';
        nextRoundButton.textContent = 'Play Again?';

        const finalRankings = [...players].sort((a, b) => b.score - a.score);

        // Clear previous content and set up for podium
        modalScoreboardGrid.innerHTML = '';
        modalScoreboardGrid.style.gridTemplateColumns = '1fr'; // Reset from previous round
        modalScoreboardGrid.classList.add('is-podium');

        const podiumContainer = document.createElement('div');
        podiumContainer.className = 'podium-container';

        const otherRanksList = document.createElement('div');
        otherRanksList.className = 'other-ranks-list';

        // Show winner banner and celebrate
        if (finalRankings.length > 0) {
            const winner = finalRankings[0];
            winnerBanner.innerHTML = `🏆 <span class="winner-name">${winner.name}</span> is the Grand Champion! 🏆`;
            winnerBanner.classList.remove('hidden');
            celebrateWinner();
        }

        // Order of podium items in the DOM for visual layout: 2nd, 1st, 3rd
        const podiumOrder = [1, 0, 2];
        const podiumPlayers = podiumOrder.map(i => finalRankings[i]).filter(p => p); // Get top 3, handles < 3 players

        podiumPlayers.forEach(player => {
            if (!player) return;
            const rank = finalRankings.indexOf(player) + 1;
            const podiumItem = document.createElement('div');
            podiumItem.className = `podium-item rank-${rank}`;
            podiumItem.innerHTML = `
                <div class="podium-rank">${getOrdinal(rank)} ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</div>
                <div class="podium-name">${player.name}</div>
                <div class="podium-score">${player.score} pts</div>
            `;
            podiumContainer.appendChild(podiumItem);
        });

        // Handle players from 4th place onwards
        if (finalRankings.length > 3) {
            let otherRanksHTML = `<div class="header">Rank</div><div class="header">Player</div><div class="header score-value">Final Score</div>`;
            finalRankings.slice(3).forEach((player, index) => {
                const rank = index + 4;
                otherRanksHTML += `<div>${getOrdinal(rank)}</div><div class="player-name-cell">${player.name}</div><div class="score-value">${player.score}</div>`;
            });
            otherRanksList.innerHTML = otherRanksHTML;
        }

        modalScoreboardGrid.appendChild(podiumContainer);
        if (finalRankings.length > 3) {
            modalScoreboardGrid.appendChild(otherRanksList);
        }
    }

    actionButton.addEventListener('click', () => {
        if (gameState === 'INITIAL') {
            actionButton.classList.remove('is-waiting');
            startRound();
            actionButton.classList.add('hidden');
        }
    });

    // Add listeners for Babu's instruction buttons
    instructChorButton.addEventListener('click', () => handleBabuInstruction('Chor'));
    instructDakatButton.addEventListener('click', () => handleBabuInstruction('Dakat'));

    // Add listener for the initial game start button
    startGameButton.addEventListener('click', initializeGame);

    // Add listener for the modal's next round button
    nextRoundButton.addEventListener('click', () => {
        nextRoundButton.classList.remove('is-waiting');
        if (gameState === 'GAME_OVER') {
            location.reload(); // Easiest way to reset the game
            return;
        }

        if (roundNumber >= MAX_ROUNDS) {
            showGameOverModal();
        } else {
            modalOverlay.classList.add('hidden');
            modalContent.classList.remove('animate-slide-in');
            startRound();
        }
    });

    // Add pressed state to all buttons for better feedback
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('mousedown', () => {
            button.classList.add('is-pressed');
            playSound(sounds.click);
        });
        button.addEventListener('mouseup', () => button.classList.remove('is-pressed'));
        button.addEventListener('mouseleave', () => button.classList.remove('is-pressed'));
    });

    // --- Rules Modal Logic ---
    function showRules() {
        rulesModalOverlay.classList.remove('hidden');
        rulesModalContent.classList.add('animate-slide-in');
    }

    function hideRules() {
        rulesModalOverlay.classList.add('hidden');
        rulesModalContent.classList.remove('animate-slide-in');
    }

    howToPlayButton.addEventListener('click', showRules);
    closeRulesButton.addEventListener('click', hideRules);
    rulesModalOverlay.addEventListener('click', (event) => {
        if (event.target === rulesModalOverlay) {
            hideRules();
        }
    });
});