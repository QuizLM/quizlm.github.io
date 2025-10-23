export const config = {
    questionsPerGroup: 50,
    timePerQuestion: 60,
    zoomStep: 0.1,
    minZoom: 0.7,
    maxZoom: 1.5,
    freePlanLimits: {
        queries: 5,
        questions: 200,
    },
    sparkPlanLimits: {
        queries: 25,
        questions: 1000,
    },
    zoomableSelectors: [
        '.container h1', '.container h2', '.container #review-question-number', '.container #review-time-taken',
        '.container .options button', '.container #explanation', '.container #review-explanation', '.container .summary-item span',
        '.container .question-numbering-area span', '.container #status-tracker', '.container #review-status-tracker',
        'button#next-btn', 'button#restart-btn', 'button#review-btn', 'button#prev-review-btn', 'button#next-review-btn', 'button#back-to-summary-btn'
    ],
    filterKeys: ['subject', 'topic', 'subTopic', 'difficulty', 'questionType', 'examName', 'examYear', 'tags']
};

export let state = {
    allQuestionsMasterList: [],
    filteredQuestionsMasterList: [],
    questionGroups: [],
    currentGroupIndex: 0,
    currentQuizData: null,
    timer: null,
    timeLeftForQuestion: 60,
    currentLifelineUsed: false,
    isMuted: false,
    isShuffleActive: false,
    isDarkMode: false,
    animationsDisabled: false,
    isHapticEnabled: true,
    bookmarkedQuestions: [],
    isAnimating: false,
    isTransitioningQuestion: false,
    isHeaderCollapsed: false,
    currentZoomMultiplier: 1.0,
    originalFontSizes: new Map(),
    fireballs_anim_array: [],
    fireballBaseSpeed_anim: 1.5,
    currentReviewIndex: 0,
    currentReviewFilter: 'all',
    filteredAttempts: [],
    ai: null,
    touchStartX: 0,
    touchStartY: 0,
    isMouseDown: false,
    isQuizActive: false,
    userProfile: null, // To store profile data like subscription status
    selectedFilters: {
        subject: [], topic: [], subTopic: [], 
        difficulty: [], questionType: [], 
        examName: [], examYear: [], 
        tags: []
    },
    callbacks: {}, // To store callbacks for inter-module communication
};

export function saveSettings() {
    try {
        const settingsToSave = {
            isShuffleActive: state.isShuffleActive,
            isMuted: state.isMuted,
            isDarkMode: state.isDarkMode,
            animationsDisabled: state.animationsDisabled,
            isHapticEnabled: state.isHapticEnabled,
            bookmarkedQuestions: state.bookmarkedQuestions,
            isHeaderCollapsed: state.isHeaderCollapsed,
        };
        localStorage.setItem('quizAppSettings', JSON.stringify(settingsToSave));
    } catch (e) {
        console.error("Could not save settings to localStorage", e);
    }
}

export function loadSettings() {
    try {
        const savedSettingsJSON = localStorage.getItem('quizAppSettings');
        if (savedSettingsJSON) {
            const savedSettings = JSON.parse(savedSettingsJSON);
            
            state.isShuffleActive = savedSettings.isShuffleActive || false;
            state.isMuted = savedSettings.isMuted || false;
            state.isDarkMode = savedSettings.isDarkMode || false;
            state.animationsDisabled = savedSettings.animationsDisabled || false;
            state.isHapticEnabled = savedSettings.isHapticEnabled !== false; // Default to true
            state.bookmarkedQuestions = savedSettings.bookmarkedQuestions || [];
            state.isHeaderCollapsed = savedSettings.isHeaderCollapsed || false;
        }
    } catch (e) {
        console.error("Could not load settings from localStorage", e);
        localStorage.removeItem('quizAppSettings');
    }
}

export function saveQuizState() {
    if (!state.isQuizActive) return;
    try {
        const sessionState = {
            isQuizActive: state.isQuizActive,
            questionGroups: state.questionGroups,
            currentGroupIndex: state.currentGroupIndex,
            selectedFilters: state.selectedFilters, // Save filters to reconstruct headers
        };
        localStorage.setItem('quizActiveSession', JSON.stringify(sessionState));
    } catch (e) {
        console.error("Could not save quiz session to localStorage", e);
    }
}

export function loadQuizState() {
    try {
        const savedSessionJSON = localStorage.getItem('quizActiveSession');
        if (savedSessionJSON) {
            const savedSession = JSON.parse(savedSessionJSON);
            state.isQuizActive = savedSession.isQuizActive || false;
            state.questionGroups = savedSession.questionGroups || [];
            state.currentGroupIndex = savedSession.currentGroupIndex || 0;
            state.selectedFilters = savedSession.selectedFilters || state.selectedFilters;
            if(state.questionGroups.length > 0) {
                 state.currentQuizData = state.questionGroups[state.currentGroupIndex];
            }
        }
    } catch (e) {
        console.error("Could not load quiz session from localStorage", e);
        clearQuizState();
    }
}

export function clearQuizState() {
    localStorage.removeItem('quizActiveSession');
}