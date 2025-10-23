import { config, state, saveSettings } from './state.js';
import { dom } from './dom.js';
import { initializeAllFireballs_anim, animateFireballs_anim } from './animations.js';
import { Toast } from './utils.js';

export function applyInitialSettings() {
    applyTheme();
    applyAnimationSetting();
    updateSoundToggleUI();
    updateShuffleToggleUI();
    updateHapticToggleUI();
}

export function toggleQuizSettings(forceClose = false) {
    if (forceClose) {
        dom.quizSettingsOverlay.classList.remove('visible');
        setTimeout(() => dom.quizSettingsOverlay.style.display = 'none', 300);
    } else {
        const isVisible = dom.quizSettingsOverlay.classList.contains('visible');
        if (isVisible) {
            dom.quizSettingsOverlay.classList.remove('visible');
            setTimeout(() => dom.quizSettingsOverlay.style.display = 'none', 300);
        } else {
            dom.quizSettingsOverlay.style.display = 'flex';
            setTimeout(() => dom.quizSettingsOverlay.classList.add('visible'), 10);
        }
    }
}

export function toggleProfileSettings(forceClose = false) {
    if (forceClose) {
        dom.profileSettingsOverlay.classList.remove('visible');
        setTimeout(() => dom.profileSettingsOverlay.style.display = 'none', 300);
    } else {
        const isVisible = dom.profileSettingsOverlay.classList.contains('visible');
        if (isVisible) {
            dom.profileSettingsOverlay.classList.remove('visible');
            setTimeout(() => dom.profileSettingsOverlay.style.display = 'none', 300);
        } else {
            dom.profileSettingsOverlay.style.display = 'flex';
            setTimeout(() => dom.profileSettingsOverlay.classList.add('visible'), 10);
        }
    }
}

export function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    applyTheme();
    saveSettings();
}

function applyTheme() {
    document.body.dataset.theme = state.isDarkMode ? 'dark' : 'light';
    if (dom.darkModeToggle) dom.darkModeToggle.checked = state.isDarkMode;
}

export function toggleAnimations() {
    state.animationsDisabled = !state.animationsDisabled;
    applyAnimationSetting();
    saveSettings();
}

function applyAnimationSetting() {
    document.body.classList.toggle('animations-disabled', state.animationsDisabled);
    if (dom.animationsToggle) dom.animationsToggle.checked = !state.animationsDisabled;
    
    if (!state.animationsDisabled && !state.isAnimating) {
        if (initializeAllFireballs_anim()) {
            state.isAnimating = true;
            animateFireballs_anim();
        }
    } else if (state.animationsDisabled) {
        state.isAnimating = false;
    }
}

export function toggleMute() {
    state.isMuted = !state.isMuted;
    updateSoundToggleUI();
    saveSettings();
}

function updateSoundToggleUI() {
    if (dom.soundToggle) dom.soundToggle.checked = !state.isMuted;
    if (dom.muteBtnReview) {
        dom.muteBtnReview.innerHTML = state.isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    }
}

export function toggleShuffle() {
    const willBeShuffled = dom.shuffleToggle.checked;
    const wasShuffled = state.isShuffleActive;

    if (willBeShuffled === wasShuffled) return;

    const targetElement = dom.quizMainContainer.style.display !== 'none' ? dom.quizMainContainer : dom.filterSection;

    Swal.fire({
        target: targetElement,
        title: 'Change Question Order?',
        text: state.isQuizActive
            ? (willBeShuffled ? "This will shuffle your remaining unanswered questions." : "This will sort your remaining questions by ID.")
            : (willBeShuffled ? "Questions will be shuffled for your next quiz." : "Questions will be sorted by ID for your next quiz."),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary-color)',
        cancelButtonColor: 'var(--wrong-color)',
        confirmButtonText: `Yes, ${willBeShuffled ? 'Shuffle' : 'Sort'}!`,
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            state.isShuffleActive = willBeShuffled;
            saveSettings();

            if (state.isQuizActive && state.callbacks.reorderQuizQuestions) {
                state.callbacks.reorderQuizQuestions();
            }
            
            Toast.fire({
                target: targetElement,
                icon: 'success',
                title: state.isQuizActive 
                    ? `Remaining questions have been ${willBeShuffled ? 'shuffled' : 'sorted'}.`
                    : `Question order set to ${willBeShuffled ? 'shuffled' : 'sorted'} for next quiz.`
            });

        } else {
            // Revert the checkbox to its original state if user cancels
            dom.shuffleToggle.checked = wasShuffled;
        }
    });
}


export function updateShuffleToggleUI() {
    if (dom.shuffleToggle) dom.shuffleToggle.checked = state.isShuffleActive;
}

export function toggleHapticFeedback() {
    state.isHapticEnabled = !state.isHapticEnabled;
    updateHapticToggleUI();
    saveSettings();
}

function updateHapticToggleUI() {
    if (dom.hapticToggle) dom.hapticToggle.checked = state.isHapticEnabled;
}

export function zoomIn() {
    if (state.currentZoomMultiplier < config.maxZoom) {
        state.currentZoomMultiplier = parseFloat((state.currentZoomMultiplier + config.zoomStep).toFixed(2));
        applyTextZoom();
    }
}

export function zoomOut() {
    if (state.currentZoomMultiplier > config.minZoom) {
        state.currentZoomMultiplier = parseFloat((state.currentZoomMultiplier - config.zoomStep).toFixed(2));
        applyTextZoom();
    }
}

export function applyTextZoom() {
    config.zoomableSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (!state.originalFontSizes.has(el)) {
                const computedStyle = window.getComputedStyle(el);
                state.originalFontSizes.set(el, parseFloat(computedStyle.fontSize));
            }
            const baseSize = state.originalFontSizes.get(el);
            if (baseSize && !isNaN(baseSize)) el.style.fontSize = (baseSize * state.currentZoomMultiplier) + 'px';
        });
    });
    updateZoomButtonStates();
}

function updateZoomButtonStates() {
    const quizZoomIn = document.getElementById('zoom-in-btn');
    const quizZoomOut = document.getElementById('zoom-out-btn');
    const reviewZoomIn = document.getElementById('zoom-in-btn-review');
    const reviewZoomOut = document.getElementById('zoom-out-btn-review');
    if (quizZoomIn) quizZoomIn.disabled = state.currentZoomMultiplier >= config.maxZoom;
    if (quizZoomOut) quizZoomOut.disabled = state.currentZoomMultiplier <= config.minZoom;
    if (reviewZoomIn) reviewZoomIn.disabled = state.currentZoomMultiplier >= config.maxZoom;
    if (reviewZoomOut) reviewZoomOut.disabled = state.currentZoomMultiplier <= config.minZoom;
}

export function toggleFullScreen() {
    const elem = document.getElementById('quiz-main-container');
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        dom.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        dom.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

export function showAIExplanation() {
    if (!dom.aiExplanationOverlay) return;
    dom.aiExplanationOverlay.style.display = 'flex';
    setTimeout(() => dom.aiExplanationOverlay.classList.add('visible'), 10);
}

export function hideAIExplanation() {
    if (!dom.aiExplanationOverlay) return;
    dom.aiExplanationOverlay.classList.remove('visible');
    setTimeout(() => dom.aiExplanationOverlay.style.display = 'none', 300);
}