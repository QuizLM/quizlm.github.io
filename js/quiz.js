import { config, state, saveQuizState, clearQuizState } from './state.js';
import { dom } from './dom.js';
import { playSound, triggerHapticFeedback, shuffleArray, buildExplanationHtml, Toast } from './utils.js';
import { typewriterAnimate } from './animations.js';
import { applyTextZoom, showAIExplanation, hideAIExplanation } from './settings.js';
import * as auth from './auth.js';

let appCallbacks = {};
let timerInterval = null;

// Helper to parse new coded IDs like "HIS1", "POL72"
function parseCodedId(idString) {
    if (typeof idString !== 'string') {
        // Fallback for old numeric IDs during transition
        return { prefix: '', num: parseInt(idString, 10) || 0 };
    }
    const match = idString.match(/^([A-Z]+)(\d+)$/);
    if (match) {
        return { prefix: match[1], num: parseInt(match[2], 10) };
    }
    // Fallback for non-matching strings or old IDs
    return { prefix: idString, num: 0 };
}

function reorderQuizQuestions() {
    if (!state.isQuizActive || !state.currentQuizData) return;

    const cd = state.currentQuizData;
    const currentIndex = cd.currentQuestionIndex;
    const currentShuffledList = cd.shuffledQuestions;
    
    // Separate past/current questions from future ones
    const pastAndCurrentQuestions = currentShuffledList.slice(0, currentIndex + 1);
    let futureQuestions = currentShuffledList.slice(currentIndex + 1);

    if (state.isShuffleActive) {
        shuffleArray(futureQuestions);
    } else {
        // Sort remaining questions back to their original order (by v1_id)
        futureQuestions.sort((a, b) => {
            const idA = parseCodedId(a.v1_id);
            const idB = parseCodedId(b.v1_id);
            if (idA.prefix < idB.prefix) return -1;
            if (idA.prefix > idB.prefix) return 1;
            return idA.num - idB.num;
        });
    }
    
    cd.shuffledQuestions = [...pastAndCurrentQuestions, ...futureQuestions];
    
    // Update navigation to reflect new order
    populateQuizInternalNavigation();
}

/**
 * Checks if a user can attempt another question based on their plan.
 * Increments the attempt counter for free/spark users. Ends the quiz if the limit is reached.
 * @returns {Promise<boolean>} True if the user can proceed, false otherwise.
 */
async function handleQuestionAttempt() {
    const profile = state.userProfile;
    // Pro users can proceed without checks
    if (!profile || profile.subscription_status === 'pro') {
        return true;
    }

    const isSpark = profile.subscription_status === 'spark';
    const limits = isSpark ? config.sparkPlanLimits : config.freePlanLimits;
    const planName = isSpark ? 'Spark' : 'Free';
    const upgradePrompt = isSpark ? 'Upgrade to Pro for unlimited attempts!' : 'Upgrade your plan to keep practicing!';

    // We check *before* incrementing to allow the last question to be processed
    if (profile.daily_questions_attempted >= limits.questions) {
        stopTimer(); // Stop the timer immediately
        Swal.fire({
            target: dom.quizMainContainer,
            title: `Daily Question Limit Reached for ${planName} Plan!`,
            html: `You've attempted your limit of <b>${limits.questions}</b> questions today. Your quiz will now end. <br>${upgradePrompt}`,
            icon: 'warning',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showCancelButton: true,
            confirmButtonColor: 'var(--primary-color)',
            cancelButtonColor: 'var(--wrong-color)',
            confirmButtonText: '<i class="fas fa-dollar-sign"></i> View Plans & End Quiz',
            cancelButtonText: 'End Quiz Now'
        }).then((result) => {
            appCallbacks.endQuiz(); // Always end the quiz after the modal
            if (result.isConfirmed && appCallbacks.openPaidServicesModal) {
                appCallbacks.openPaidServicesModal();
            }
        });
        return false; // Prevent further action
    }

    // Increment the counter
    const newCount = profile.daily_questions_attempted + 1;
    const updatedProfile = await auth.updateUserProfile(profile.id, { daily_questions_attempted: newCount });

    if (updatedProfile) {
        state.userProfile = updatedProfile; // Keep local state in sync
    }
    // Optimistically allow the user to proceed
    return true;
}


export function initQuizModule(callbacks) {
    appCallbacks = callbacks;
    // Register this module's functions as callbacks for the main controller
    callbacks.nextQuestionHandler = nextQuestionHandler;
    callbacks.previousQuestionHandler = previousQuestionHandler;
    callbacks.quizKeyPressHandler = handleKeyPress;
    callbacks.toggleQuizInternalNavigation = toggleQuizInternalNavigation;
    callbacks.reorderQuizQuestions = reorderQuizQuestions;
    
    bindQuizEventListeners();
    initializeGemini();
}

export function loadQuiz() {
    divideQuestionsIntoGroups(state.filteredQuestionsMasterList);

    // Immediately process only the first group for a fast start
    if (state.questionGroups.length > 0) {
        const firstGroup = state.questionGroups[0];
        if (state.isShuffleActive) {
            firstGroup.shuffledQuestions = [...firstGroup.questions];
            shuffleArray(firstGroup.shuffledQuestions);
        } else {
            // Default sort by coded ID (prefix then number)
            firstGroup.shuffledQuestions = [...firstGroup.questions].sort((a, b) => {
                const idA = parseCodedId(a.v1_id);
                const idB = parseCodedId(b.v1_id);
                if (idA.prefix < idB.prefix) return -1;
                if (idA.prefix > idB.prefix) return 1;
                return idA.num - idB.num;
            });
        }
    }
    
    state.currentGroupIndex = 0;
    loadQuestionGroup(state.currentGroupIndex);
    startQuizLogicForGroup();
    applyHeaderCollapsedState();

    // Process the rest of the groups in the background to not block the UI
    if (state.questionGroups.length > 1) {
        setTimeout(() => {
            console.log("Starting background processing of remaining question groups...");
            for (let i = 1; i < state.questionGroups.length; i++) {
                const group = state.questionGroups[i];
                if (state.isShuffleActive) {
                    group.shuffledQuestions = [...group.questions];
                    shuffleArray(group.shuffledQuestions);
                } else {
                    group.shuffledQuestions = [...group.questions].sort((a, b) => {
                        const idA = parseCodedId(a.v1_id);
                        const idB = parseCodedId(b.v1_id);
                        if (idA.prefix < idB.prefix) return -1;
                        if (idA.prefix > idB.prefix) return 1;
                        return idA.num - idB.num;
                    });
                }
            }
            console.log("Background processing of question groups complete.");
        }, 500); // Delay to ensure the UI is responsive first
    }
}


export function resumeLoadedQuiz() {
    // Assumes state.questionGroups and state.currentGroupIndex are already populated from localStorage
    loadQuestionGroup(state.currentGroupIndex);
    startQuizLogicForGroup();
    applyHeaderCollapsedState();
}

function bindQuizEventListeners() {
    dom.navOverlay.addEventListener('click', () => toggleQuizInternalNavigation());
    dom.prevQuestionBtn.onclick = () => previousQuestionHandler();
    dom.nextQuestionBtn.onclick = () => nextQuestionHandler();
    dom.markReviewBtn.onclick = () => toggleMarkForReview();
    dom.aiExplainerBtn.addEventListener('click', () => getGeminiExplanation());
    dom.lifelineBtn.onclick = () => useLifeline();
    dom.nextBtn.onclick = () => nextQuestionHandler();
    dom.toggleHeaderBtn.addEventListener('click', toggleHeader);
    dom.bookmarkBtn.addEventListener('click', toggleBookmark);


    const submitQuizBtn = document.getElementById('submit-quiz-btn');
    if (submitQuizBtn) submitQuizBtn.onclick = () => submitAndReviewAll();
}

function initializeGemini() {
    console.log("AI Explainer feature is for demonstration. A backend proxy is needed for full functionality.");
    if (dom.aiExplainerBtn) {
        dom.aiExplainerBtn.title = "Get an AI-powered explanation (requires backend setup).";
        dom.aiExplainerBtn.style.display = 'none'; // Hidden until implemented
    }
    state.ai = null;
}

function divideQuestionsIntoGroups(questionsList) {
    state.questionGroups = [];
    const totalQuestions = questionsList.length;
    for (let i = 0; i < totalQuestions; i += config.questionsPerGroup) {
        const groupQuestions = questionsList.slice(i, i + config.questionsPerGroup);
        const startQ = i + 1;
        const endQ = Math.min(i + config.questionsPerGroup, totalQuestions);
        state.questionGroups.push({
            groupName: `Questions ${startQ}-${endQ}`,
            questions: groupQuestions,
            shuffledQuestions: [],
            attempts: [],
            markedForReview: [],
            isSubmenuOpen: true,
        });
    }
}

function loadQuestionGroup(newGroupIndex) {
    if (newGroupIndex < 0 || newGroupIndex >= state.questionGroups.length) return;
    
    // UX IMPROVEMENT: Set active group and collapse others for the nav panel
    state.questionGroups.forEach((group, index) => {
        group.isSubmenuOpen = (index === newGroupIndex);
    });

    state.currentGroupIndex = newGroupIndex;
    state.currentQuizData = state.questionGroups[state.currentGroupIndex];
    
    if (!state.currentQuizData) {
        console.error(`Attempted to load a null or undefined question group at index ${newGroupIndex}.`);
        appCallbacks.restartFullQuiz();
        return;
    }
    
    if (state.currentQuizData.attempts.length > 0) {
        const answeredIds = new Set(state.currentQuizData.attempts.map(a => a.questionId));
        let firstUnansweredIndex = state.currentQuizData.shuffledQuestions.findIndex(q => !answeredIds.has(q.id));
        if (firstUnansweredIndex === -1) { 
            // This case occurs when resuming a completed group. Go to the last question.
            state.currentQuizData.currentQuestionIndex = state.currentQuizData.shuffledQuestions.length -1;
        } else {
            state.currentQuizData.currentQuestionIndex = firstUnansweredIndex;
        }
    } else {
        state.currentQuizData.currentQuestionIndex = 0;
    }

    dom.quizSection.style.display = 'block';
    dom.quizSection.classList.add('section-fade-in');

    displayQuestion();
    updateStatusTracker();
    populateQuizInternalNavigation();
    saveQuizState();
}

function startQuizLogicForGroup() {
    if (!state.currentQuizData || state.currentQuizData.questions.length === 0) return;
    applyTextZoom();
    updateStatusTracker();
    updateQuizProgressBar();
}

function checkAnswer(selectedEnglishOption, button) {
    // --- IMMEDIATE UI FEEDBACK (Part 1) ---
    stopTimer();
    dom.timerBar.classList.add('paused');
    dom.optionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);

    const cd = state.currentQuizData;
    const currentQuestion = cd.shuffledQuestions[cd.currentQuestionIndex];
    const isCorrect = selectedEnglishOption.trim() === currentQuestion.correct.trim();

    // --- IMMEDIATE UI FEEDBACK (Part 2) ---
    if (isCorrect) {
        button.classList.add('correct');
        playSound('correct-sound');
        triggerHapticFeedback('correct');
        dom.timerBar.classList.add('correct-pause');
    } else {
        button.classList.add('wrong');
        playSound('wrong-sound');
        triggerHapticFeedback('wrong');
        dom.optionsEl.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.option.trim() === currentQuestion.correct.trim()) {
                btn.classList.add('reveal-correct');
            }
        });
    }

    // --- LOCAL STATE UPDATE & EXPLANATION ---
    const timeTaken = config.timePerQuestion - state.timeLeftForQuestion;
    const existingAttemptIndex = cd.attempts.findIndex(a => a.questionId === currentQuestion.id);
    const attempt = {
        questionId: currentQuestion.id,
        v1_id: currentQuestion.v1_id,
        question: currentQuestion.question,
        question_hi: currentQuestion.question_hi,
        options: currentQuestion.options,
        options_hi: currentQuestion.options_hi,
        optionsDisplayed: Array.from(dom.optionsEl.querySelectorAll('button')).map(btn => btn.dataset.option),
        optionsDisplayedBilingual: Array.from(dom.optionsEl.querySelectorAll('button')).map(btn => ({
            eng: btn.dataset.option,
            hin: btn.dataset.optionHi
        })),
        correct: currentQuestion.correct,
        selected: selectedEnglishOption,
        status: isCorrect ? 'Correct' : 'Wrong',
        timeTaken: timeTaken,
        explanation: currentQuestion.explanation,
    };

    if (existingAttemptIndex > -1) {
        cd.attempts[existingAttemptIndex] = attempt;
    } else {
        cd.attempts.push(attempt);
    }
    
    dom.explanationEl.innerHTML = '';
    dom.explanationEl.style.display = 'block';
    typewriterAnimate(dom.explanationEl, buildExplanationHtml(currentQuestion.explanation));
    dom.aiExplainerBtn.disabled = false;

    updateStatusTracker();
    updateQuizProgressBar();

    if (cd.currentQuestionIndex < cd.shuffledQuestions.length - 1 || state.currentGroupIndex < state.questionGroups.length - 1) {
        dom.nextBtn.style.display = 'block';
    } else {
        dom.nextBtn.style.display = 'none';
    }

    saveQuizState();
    
    // --- BACKGROUND TASK ---
    // Run the attempt check/update in the background without blocking the UI.
    handleQuestionAttempt();
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function startTimer() {
    stopTimer();
    state.timeLeftForQuestion = config.timePerQuestion;
    dom.timerDisplay.textContent = `${state.timeLeftForQuestion}s`;
    dom.timerBar.classList.remove('paused', 'correct-pause');
    dom.timerBar.style.transition = `width ${config.timePerQuestion}s linear`;
    dom.timerBar.style.width = '0%';

    timerInterval = setInterval(() => {
        state.timeLeftForQuestion--;
        dom.timerDisplay.textContent = `${state.timeLeftForQuestion}s`;
        if (state.timeLeftForQuestion <= 0) {
            handleTimeout();
        } else if (state.timeLeftForQuestion <= 10) {
            dom.timerElement.classList.add('timeout');
        }
    }, 1000);
}

function handleTimeout() {
    // --- IMMEDIATE UI FEEDBACK ---
    stopTimer();
    dom.optionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);
    dom.timeoutOverlay.classList.add('visible');
    setTimeout(() => dom.timeoutOverlay.classList.remove('visible'), 1500);

    const cd = state.currentQuizData;
    const currentQuestion = cd.shuffledQuestions[cd.currentQuestionIndex];
    
    // --- LOCAL STATE UPDATE & EXPLANATION ---
    const existingAttemptIndex = cd.attempts.findIndex(a => a.questionId === currentQuestion.id);
    const attempt = {
        questionId: currentQuestion.id, v1_id: currentQuestion.v1_id, question: currentQuestion.question,
        question_hi: currentQuestion.question_hi, options: currentQuestion.options,
        options_hi: currentQuestion.options_hi, correct: currentQuestion.correct,
        selected: 'Timed Out', status: 'Timeout', timeTaken: config.timePerQuestion,
        explanation: currentQuestion.explanation,
        optionsDisplayed: Array.from(dom.optionsEl.querySelectorAll('button')).map(btn => btn.dataset.option),
        optionsDisplayedBilingual: Array.from(dom.optionsEl.querySelectorAll('button')).map(btn => ({
            eng: btn.dataset.option,
            hin: btn.dataset.optionHi
        })),
    };

    if (existingAttemptIndex > -1) cd.attempts[existingAttemptIndex] = attempt;
    else cd.attempts.push(attempt);
    
    dom.explanationEl.innerHTML = '';
    dom.explanationEl.style.display = 'block';
    typewriterAnimate(dom.explanationEl, buildExplanationHtml(currentQuestion.explanation));
    
    dom.optionsEl.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.option.trim() === currentQuestion.correct.trim()) {
            btn.classList.add('reveal-correct');
        }
    });

    updateStatusTracker();
    updateQuizProgressBar();

    if (cd.currentQuestionIndex < cd.shuffledQuestions.length - 1 || state.currentGroupIndex < state.questionGroups.length - 1) {
        dom.nextBtn.style.display = 'block';
    }
    
    saveQuizState();

    // --- BACKGROUND TASK ---
    // Run the attempt check/update in the background without blocking the UI.
    handleQuestionAttempt();
}

function displayQuestion() {
    if (state.isTransitioningQuestion) return;
    state.isTransitioningQuestion = true;

    dom.quizContainer.classList.add('is-transitioning-out');
    
    setTimeout(() => {
        const cd = state.currentQuizData;
        const index = cd.currentQuestionIndex;
        const question = cd.shuffledQuestions[index];

        // Reset UI
        dom.timerElement.classList.remove('timeout');
        dom.explanationEl.style.display = 'none';
        dom.nextBtn.style.display = 'none';
        state.originalFontSizes.clear();

        // Question text
        const cleanQuestion = (question.question || "").replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '');
        const cleanQuestionHi = (question.question_hi || "").replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '');
        dom.questionTextEl.innerHTML = `${cleanQuestion}${cleanQuestionHi ? '<hr class="lang-separator"><span class="hindi-text">' + cleanQuestionHi + '</span>' : ''}`;

        // Question metadata
        dom.sequentialQuestionNumberEl.textContent = `Q ${index + 1}/${cd.shuffledQuestions.length}`;
        dom.actualQuestionNumberEl.textContent = `ID: ${question.v1_id || question.id}`;
        dom.examNameTag.textContent = question.examName || 'N/A';
        dom.examDateShiftTag.textContent = `${question.examYear || ''} ${question.examDateShift || ''}`.trim();

        // Bookmark status
        dom.bookmarkBtn.classList.toggle('bookmarked', state.bookmarkedQuestions.includes(question.id));
        dom.bookmarkBtn.innerHTML = state.bookmarkedQuestions.includes(question.id) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        
        // Mark for review status
        const isMarked = cd.markedForReview.includes(question.id);
        dom.markReviewBtn.classList.toggle('marked', isMarked);
        dom.markReviewBtn.innerHTML = isMarked ? '<i class="fas fa-flag"></i> Marked' : '<i class="far fa-flag"></i> Mark for Review';

        // Options
        dom.optionsEl.innerHTML = '';
        let optionsBilingual = (question.options || []).map((eng, i) => ({ eng, hin: (question.options_hi || [])[i] || '' }));
        if (state.isShuffleActive) shuffleArray(optionsBilingual);

        optionsBilingual.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerHTML = `${opt.eng}${opt.hin ? '<br><span class="hindi-text">' + opt.hin + '</span>' : ''}`;
            btn.dataset.option = opt.eng; // Store original English text for checking
            btn.dataset.optionHi = opt.hin;
            btn.onclick = () => checkAnswer(opt.eng, btn);
            dom.optionsEl.appendChild(btn);
        });

        // Lifeline
        dom.lifelineBtn.disabled = false;
        state.currentLifelineUsed = false;
        dom.aiExplainerBtn.disabled = true;

        // Apply visual state
        applyTextZoom();
        updateStatusTracker();
        updateQuizProgressBar();

        // Transition back in
        dom.quizContainer.classList.remove('is-transitioning-out');
        dom.quizContainer.classList.add('is-transitioning-in');
        
        setTimeout(() => {
            dom.quizContainer.classList.remove('is-transitioning-in');
            state.isTransitioningQuestion = false;
            startTimer();
        }, 300);

    }, 200);
}

function previousQuestionHandler() {
    if (state.isTransitioningQuestion) return;
    const cd = state.currentQuizData;
    if (cd.currentQuestionIndex > 0) {
        cd.currentQuestionIndex--;
        displayQuestion();
        saveQuizState();
    }
}

function nextQuestionHandler() {
    if (state.isTransitioningQuestion) return;
    const cd = state.currentQuizData;
    if (cd.currentQuestionIndex < cd.shuffledQuestions.length - 1) {
        cd.currentQuestionIndex++;
        displayQuestion();
    } else if (state.currentGroupIndex < state.questionGroups.length - 1) {
        // Move to the next group
        state.currentGroupIndex++;
        loadQuestionGroup(state.currentGroupIndex);
        appCallbacks.updateDynamicHeaders();
    } else {
        // Last question of last group, end the quiz
        appCallbacks.endQuiz();
    }
    saveQuizState();
}

function useLifeline() {
    if (state.currentLifelineUsed) return;
    state.currentLifelineUsed = true;
    dom.lifelineBtn.disabled = true;
    const cd = state.currentQuizData;
    const question = cd.shuffledQuestions[cd.currentQuestionIndex];
    const correctOption = question.correct;
    const incorrectOptions = Array.from(dom.optionsEl.querySelectorAll('button'))
        .filter(btn => btn.dataset.option.trim() !== correctOption.trim());
    
    shuffleArray(incorrectOptions);
    incorrectOptions.slice(0, 2).forEach(btn => btn.classList.add('lifeline-disabled'));
}

function updateStatusTracker() {
    if (!dom.statusTrackerEl || !state.currentQuizData) return;
    const cd = state.currentQuizData;
    const total = cd.shuffledQuestions.length;
    const answered = new Set(cd.attempts.map(a => a.questionId)).size;
    const notAnswered = total - answered;
    const marked = cd.markedForReview.length;
    
    dom.statusTrackerEl.innerHTML = `<span>Answered: ${answered}</span> | <span>Not Answered: ${notAnswered}</span> | <span>Marked: ${marked}</span>`;
}

function updateQuizProgressBar() {
    const cd = state.currentQuizData;
    const progress = (cd.currentQuestionIndex / cd.shuffledQuestions.length) * 100;
    dom.quizProgressBar.style.width = `${progress}%`;
}

function populateQuizInternalNavigation() {
    const navContent = dom.navigationPanel.querySelector('.nav-panel-content');
    if (!navContent) return;
    navContent.innerHTML = '';
    
    state.questionGroups.forEach((group, groupIndex) => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'nav-group-item';

        const header = document.createElement('div');
        header.className = 'nav-group-header-clickable';
        header.innerHTML = `<span>${group.groupName}</span><i class="fas fa-chevron-down toggle-icon"></i>`;

        const grid = document.createElement('div');
        grid.className = 'nav-question-grid';
        
        group.shuffledQuestions.forEach((q, qIndex) => {
            const attempt = group.attempts.find(a => a.questionId === q.id);
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'nav-grid-item';
            item.textContent = qIndex + 1;
            item.dataset.questionIndex = qIndex;
            
            if (attempt) item.dataset.status = attempt.status.toLowerCase();
            if (group.markedForReview.includes(q.id)) item.classList.add('marked-for-review');
            if (groupIndex === state.currentGroupIndex && qIndex === state.currentQuizData.currentQuestionIndex) item.classList.add('active-question');

            item.onclick = (e) => {
                e.preventDefault();
                if (groupIndex !== state.currentGroupIndex) {
                    loadQuestionGroup(groupIndex);
                }
                state.currentQuizData.currentQuestionIndex = qIndex;
                displayQuestion();
                toggleQuizInternalNavigation();
            };
            grid.appendChild(item);
        });

        header.onclick = () => {
            group.isSubmenuOpen = !group.isSubmenuOpen;
            grid.classList.toggle('open', group.isSubmenuOpen);
            header.querySelector('.toggle-icon').classList.toggle('rotated', !group.isSubmenuOpen);
        };
        grid.classList.toggle('open', group.isSubmenuOpen);
        header.querySelector('.toggle-icon').classList.toggle('rotated', !group.isSubmenuOpen);

        groupContainer.appendChild(header);
        groupContainer.appendChild(grid);
        navContent.appendChild(groupContainer);
    });
}

function toggleQuizInternalNavigation() {
    const isOpen = dom.navigationPanel.classList.toggle('open');
    dom.navOverlay.classList.toggle('active', isOpen);
    dom.navMenuIcon.classList.toggle('is-active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';

    // UX IMPROVEMENT: Auto-scroll to the active question when opening the panel
    if (isOpen) {
        const activeItem = dom.navigationPanel.querySelector('.nav-grid-item.active-question');
        if (activeItem) {
            // Use a short timeout to allow the panel's open animation to start
            setTimeout(() => {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200); 
        }
    }
}

function submitAndReviewAll() {
    Swal.fire({
        target: dom.quizMainContainer,
        position: 'top',
        title: 'Submit this group?',
        text: "You won't be able to change your answers for this group.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary-color)',
        cancelButtonColor: 'var(--wrong-color)',
        confirmButtonText: 'Yes, submit!'
    }).then((result) => {
        if (result.isConfirmed) {
            stopTimer();
            appCallbacks.endQuiz();
        }
    });
}

function handleKeyPress(event) {
    if (event.key === 'ArrowLeft') {
        if (dom.prevQuestionBtn && !dom.prevQuestionBtn.disabled) previousQuestionHandler();
    } else if (event.key === 'ArrowRight') {
        if (dom.nextQuestionBtn && !dom.nextQuestionBtn.disabled) nextQuestionHandler();
    } else if (event.key === 'Enter') {
        if (dom.nextBtn && dom.nextBtn.style.display !== 'none') nextQuestionHandler();
    }
}

function toggleHeader() {
    state.isHeaderCollapsed = !state.isHeaderCollapsed;
    applyHeaderCollapsedState();
    saveSettings();
}

function applyHeaderCollapsedState() {
    dom.collapsibleHeaderContent.classList.toggle('collapsed', state.isHeaderCollapsed);
    dom.toggleHeaderBtn.classList.toggle('collapsed', state.isHeaderCollapsed);
}

function toggleBookmark() {
    const cd = state.currentQuizData;
    const questionId = cd.shuffledQuestions[cd.currentQuestionIndex].id;
    const index = state.bookmarkedQuestions.indexOf(questionId);
    if (index > -1) {
        state.bookmarkedQuestions.splice(index, 1);
        dom.bookmarkBtn.classList.remove('bookmarked');
        dom.bookmarkBtn.innerHTML = '<i class="far fa-star"></i>';
        Toast.fire({icon: 'info', title: 'Bookmark removed'});
    } else {
        state.bookmarkedQuestions.push(questionId);
        dom.bookmarkBtn.classList.add('bookmarked');
        dom.bookmarkBtn.innerHTML = '<i class="fas fa-star"></i>';
        Toast.fire({icon: 'success', title: 'Question bookmarked!'});
    }
    saveSettings();
}

function toggleMarkForReview() {
    const cd = state.currentQuizData;
    const questionId = cd.shuffledQuestions[cd.currentQuestionIndex].id;
    const index = cd.markedForReview.indexOf(questionId);
    
    if (index > -1) {
        cd.markedForReview.splice(index, 1);
    } else {
        cd.markedForReview.push(questionId);
    }

    const isMarked = cd.markedForReview.includes(questionId);
    dom.markReviewBtn.classList.toggle('marked', isMarked);
    dom.markReviewBtn.innerHTML = isMarked ? '<i class="fas fa-flag"></i> Marked' : '<i class="far fa-flag"></i> Mark for Review';
    
    updateStatusTracker();
    populateQuizInternalNavigation(); // To update the nav grid item
    saveQuizState();
}

async function getGeminiExplanation() {
   // This is a placeholder for a future implementation.
   // It would require setting up the Gemini API in state.js and calling it here.
   Toast.fire({
       icon: 'info',
       title: 'AI Explainer Coming Soon!',
       text: 'This feature is currently under development.'
   });
}