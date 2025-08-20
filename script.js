import { ROLES, MAX_ROUNDS } from './config.js';
import * as ui from './ui.js'; // Import all UI functions and elements

document.addEventListener('DOMContentLoaded', () => {
    // Animate title on load
    const setupTitle = document.querySelector('#setup-container h1');
    if (setupTitle) {
        setupTitle.innerHTML = setupTitle.textContent.split('').map((letter, i) =>
            `<span class="title-letter" style="animation-delay: ${i * 50}ms">${letter === ' ' ? '&nbsp;' : letter}</span>`).join('');
    }

    let players = [];
    let playerRoles = [];
    let targetRoleName = null;
    let roundNumber = 0;
    let gameState = 'SETUP'; // SETUP, INITIAL, BABU_INSTRUCTS, POLICE_GUESS, ROUND_OVER, GAME_OVER

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function initializeGame() {
        // Play ambient music. It will loop automatically.
        if (ui.sounds.ambient) {
            ui.sounds.ambient.volume = 0.3; // Lower volume for background music
            ui.sounds.ambient.play().catch(error => {
                // Autoplay is often blocked by browsers until a user interaction.
                // This is fine since initializeGame is called on a button click.
                console.error(`Ambient audio play failed: ${error}`);
            });
        }
        players = ui.elements.playerInputs.map((input, index) => ({
            name: input.value.trim() || `Player ${index + 1}`,
            score: 0,
            lastRoundScore: 0
        }));

        ui.elements.setupContainer.classList.add('hidden');
        ui.elements.gameContainer.classList.remove('hidden');
        ui.elements.gameContainer.classList.add('animate-fade-in');

        ui.elements.playerDisplayNames.forEach((nameEl, index) => {
            nameEl.textContent = players[index].name;
        });

        gameState = 'INITIAL';
        updatePersistentScoreboard();
        ui.elements.actionButton.classList.add('is-waiting');
        ui.updateStatusMessage('The stage is set. Begin the round when ready.');
    }

    function updatePersistentScoreboard() {
        const scoreEntries = ui.elements.persistentScoreboard.querySelectorAll('.score-entry');
        let scoreboardHTML = '';
        players.forEach((player, index) => {
            const oldEntry = scoreEntries[index];
            const oldScore = oldEntry ? oldEntry.textContent : null;
            const newScore = `${player.score} pts`;
            // Add animation class only if the score has changed
            const animationClass = (oldEntry && oldScore !== newScore) ? 'animate-score-update' : '';
            scoreboardHTML += `<div class="score-entry ${animationClass}">${newScore}</div>`;
        });
        ui.elements.persistentScoreboard.innerHTML = scoreboardHTML;
    }

    function resetCards() {
        ui.elements.playerCards.forEach((card, index) => {
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
        playerRoles = shuffle([...ROLES]);

        ui.elements.playerCards.forEach((card, index) => {
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
                ui.playSound(ui.sounds.deal);
            }, 150 * (index + 1));
        });

        ui.elements.actionButton.classList.add('hidden');
        // Wait for the card dealing animation to complete before flipping the Babu's card.
        // This ensures the flip animation is visible.
        const dealTime = 150 * ui.elements.playerCards.length + 400; // Staggered deal time + buffer
        setTimeout(promptBabuToInstruct, dealTime);
    }

    function promptBabuToInstruct() {
        gameState = 'BABU_INSTRUCTS';
        const babuIndex = playerRoles.findIndex(r => r.name === 'Babu');
        const babuName = players[babuIndex].name;

        setActivePlayer(babuIndex);
        // Flip Babu's card immediately
        ui.elements.playerCards[babuIndex].classList.add('flipped', 'babu-reveal');
        ui.playSound(ui.sounds.flip);
        ui.updateStatusMessage(`A royal decree! ${babuName}, the Babu, must secretly command the Police.`);
        const panel = ui.elements.babuInstructionPanel;
        panel.classList.remove('hidden', 'animate-slide-up');
        panel.classList.add('animate-slide-down');
    }

    function handleBabuInstruction(target) {
        if (gameState !== 'BABU_INSTRUCTS') return;

        targetRoleName = target;
        const panel = ui.elements.babuInstructionPanel;
        panel.classList.remove('animate-slide-down');
        panel.classList.add('animate-slide-up');
        panel.addEventListener('animationend', (e) => {
            if (e.target === panel) { // Ensure it's the panel's animation, not a child's
                panel.classList.add('hidden');
            }
        }, { once: true });
        revealRoles();
    }
    function revealRoles() {
        const policeIndex = playerRoles.findIndex(r => r.name === 'Police');

        ui.updateStatusMessage(`The order is given! The loyal Police is revealed...`);

        // Flip Police's card
        setTimeout(() => {
            ui.elements.playerCards[policeIndex].classList.add('flipped', 'police-reveal');
            ui.playSound(ui.sounds.flip);
            setActivePlayer(policeIndex);
            promptPoliceToGuess(policeIndex);
        }, 1500);
    }

    function promptPoliceToGuess(policeIndex) {
        gameState = 'POLICE_GUESS';
        ui.elements.actionButton.classList.add('hidden');
        const policeName = players[policeIndex].name;
        ui.updateStatusMessage(`${policeName}, your orders are clear: Unmask the ${targetRoleName}!`);


        ui.elements.playerCards.forEach((card, index) => {
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
        const guessedIndex = Array.from(ui.elements.playerCards).indexOf(guessedCard);

        // Disable further clicks
        ui.elements.playerCards.forEach(card => {
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
            ui.playSound(ui.sounds.correct);
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
            ui.playSound(ui.sounds.wrong);
        }

        let roundScores = playerRoles.map(r => r.points);

        if (guessedIndex === targetIndex) {
            // Correct Guess
            ui.updateStatusMessage(`Justice is served! ${targetPlayerName} was the ${targetRoleName}.`);
            roundScores[targetIndex] = 0; // The caught person gets 0.
        } else {
            // Incorrect Guess
            ui.updateStatusMessage(`A costly mistake! The ${targetRoleName} has escaped justice.`);
            roundScores[policeIndex] = 0;
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
        ui.elements.playerCards.forEach((card, index) => {
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
                ui.playSound(ui.sounds.flip);
            }, delay);
        });

        setTimeout(() => {
            gameState = 'ROUND_OVER';
            showDetailedScoreboardModal(); // Show the new modal
        // Wait 1.5s after the *last* card starts flipping
        }, 1500 + lastFlipDelay);
    }

    function showDetailedScoreboardModal() {
        ui.elements.modalOverlay.classList.remove('hidden');
        ui.elements.winnerBanner.classList.add('hidden'); // Hide winner banner during round results
        ui.elements.modalContent.classList.add('animate-slide-in');

        ui.elements.modalScoreboardGrid.classList.remove('is-podium');

        ui.elements.modalTitle.textContent = `Round ${roundNumber} of ${MAX_ROUNDS} Results`;

        if (roundNumber >= MAX_ROUNDS) {
            ui.elements.nextRoundButton.textContent = 'Show Final Results';
            ui.elements.nextRoundButton.classList.add('is-waiting');
        } else {
            ui.elements.nextRoundButton.textContent = 'Play Next Round';
            ui.elements.nextRoundButton.classList.add('is-waiting');
        }

        let gridHTML = `
            <div class="header-row">
                <div class="header">Player</div>
                <div class="header">Role</div>
                <div class="header score-value">Round Points</div>
                <div class="header score-value">New Total</div>
            </div>
        `;

        players.forEach((player, index) => {
            const role = playerRoles[index];
            const roundPoints = player.lastRoundScore;
            const sign = roundPoints >= 0 ? '+' : '';
            const rowDelay = 150 * index;
            const popDelay1 = rowDelay + 250; // Pop after the row slides in
            const popDelay2 = popDelay1 + 100;

            gridHTML += `
                <div class="player-result-row animate-slide-in-left" style="animation-delay: ${rowDelay}ms">
                    <div class="player-name-cell">${player.name}</div>
                    <div class="player-role-cell">${role.icon} ${role.name}</div>
                    <div class="player-round-score-cell score-value animate-pop" style="animation-delay: ${popDelay1}ms">${sign}${roundPoints}</div>
                    <div class="player-total-score-cell score-value animate-pop" style="animation-delay: ${popDelay2}ms">${player.score}</div>
                </div>
            `;
        });
        ui.elements.modalScoreboardGrid.innerHTML = gridHTML;
    }

    function getOrdinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function celebrateWinner() {
        ui.playSound(ui.sounds.win);
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
        ui.elements.modalTitle.textContent = 'Final Results!';
        ui.elements.nextRoundButton.textContent = 'Play Again?';

        const finalRankings = [...players].sort((a, b) => b.score - a.score);

        // Clear previous content and set up for podium
        ui.elements.modalScoreboardGrid.innerHTML = '';
        ui.elements.modalScoreboardGrid.classList.add('is-podium');

        const podiumContainer = document.createElement('div');
        podiumContainer.className = 'podium-container';

        const otherRanksList = document.createElement('div');
        otherRanksList.className = 'other-ranks-list';

        // Show winner banner and celebrate
        if (finalRankings.length > 0) {
            const winner = finalRankings[0];
            ui.elements.winnerBanner.innerHTML = `🏆 <span class="winner-name">${winner.name}</span> is the Grand Champion! 🏆`;
            ui.elements.winnerBanner.classList.remove('hidden');
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

        ui.elements.modalScoreboardGrid.appendChild(podiumContainer);
        if (finalRankings.length > 3) {
            ui.elements.modalScoreboardGrid.appendChild(otherRanksList);
        }
    }

    ui.elements.actionButton.addEventListener('click', () => {
        if (gameState === 'INITIAL') {
            const button = ui.elements.actionButton;
            button.classList.remove('is-waiting'); // Stop pulsing
            button.classList.add('animate-zoom-out');
            button.addEventListener('animationend', () => {
                startRound(); // This function will add the 'hidden' class
                button.classList.remove('animate-zoom-out'); // Clean up
            }, { once: true });
        }
    });

    // Add listeners for Babu's instruction buttons
    ui.elements.instructChorButton.addEventListener('click', () => handleBabuInstruction('Chor'));
    ui.elements.instructDakatButton.addEventListener('click', () => handleBabuInstruction('Dakat'));

    // Add listener for the initial game start button
    ui.elements.startGameButton.addEventListener('click', initializeGame);

    // Add listener for the modal's next round button
    ui.elements.nextRoundButton.addEventListener('click', () => {
        ui.elements.nextRoundButton.classList.remove('is-waiting');
        if (gameState === 'GAME_OVER') {
            location.reload(); // Easiest way to reset the game
            return;
        }

        if (roundNumber >= MAX_ROUNDS) {
            showGameOverModal();
        } else {
            ui.elements.modalOverlay.classList.add('hidden');
            ui.elements.modalContent.classList.remove('animate-slide-in');
            startRound();
        }
    });

    // Add pressed state to all buttons for better feedback
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('mousedown', () => {
            button.classList.add('is-pressed');
            ui.playSound(ui.sounds.click);
        });
        button.addEventListener('mouseup', () => button.classList.remove('is-pressed'));
        button.addEventListener('mouseleave', () => button.classList.remove('is-pressed'));
    });

    // --- Rules Modal Logic ---
    function showRules() {
        ui.elements.rulesModalOverlay.classList.remove('hidden');
        ui.elements.rulesModalContent.classList.add('animate-slide-in');
    }

    function hideRules() {
        ui.elements.rulesModalOverlay.classList.add('hidden');
        ui.elements.rulesModalContent.classList.remove('animate-slide-in');
    }

    ui.elements.howToPlayButton.addEventListener('click', showRules);
    ui.elements.closeRulesButton.addEventListener('click', hideRules);
    ui.elements.rulesModalOverlay.addEventListener('click', (event) => {
        if (event.target === ui.elements.rulesModalOverlay) {
            hideRules();
        }
    });
});
