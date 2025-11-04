export let dom = {
    filterElements: {},
    tagContainers: {}
};

export function cacheDomElements() {
    // Auth & Consent
    dom.loginGate = document.getElementById('login-gate');
    dom.signInBtn = document.getElementById('sign-in-btn');
    dom.logoutBtn = document.getElementById('logout-btn');
    dom.ageConsentCheckbox = document.getElementById('age-consent-checkbox');
    dom.privacyConsentCheckbox = document.getElementById('privacy-consent-checkbox');
    dom.privacyPolicyLink = document.getElementById('privacy-policy-link');

    // NEW Email/Password Auth elements
    dom.signInTab = document.getElementById('sign-in-tab');
    dom.signUpTab = document.getElementById('sign-up-tab');
    dom.signInForm = document.getElementById('sign-in-form');
    dom.signUpForm = document.getElementById('sign-up-form');
    dom.signinEmail = document.getElementById('signin-email');
    dom.signinPassword = document.getElementById('signin-password');
    dom.signInEmailBtn = document.getElementById('sign-in-email-btn');
    dom.signupName = document.getElementById('signup-name');
    dom.signupEmail = document.getElementById('signup-email');
    dom.signupPassword = document.getElementById('signup-password');
    dom.signUpEmailBtn = document.getElementById('sign-up-email-btn');
    dom.consentSection = document.querySelector('.consent-section');
    dom.googleBtnText = document.getElementById('google-btn-text');

    // Privacy Policy Modal
    dom.privacyPolicyOverlay = document.getElementById('privacy-policy-overlay');
    dom.privacyPolicyCloseBtn = document.getElementById('privacy-policy-close-btn');

    // NEW: Homepage and Side Menu
    dom.homepageSection = document.getElementById('homepage-section');
    dom.hamburgerMenuBtn = document.getElementById('hamburger-menu-btn');
    dom.sideMenuOverlay = document.getElementById('side-menu-overlay');
    dom.sideMenuPanel = document.querySelector('.side-menu-panel');
    dom.sideMenuCloseBtn = document.getElementById('side-menu-close-btn');
    dom.sideMenuProfilePic = document.getElementById('side-menu-profile-pic');
    dom.sideMenuProfileName = document.getElementById('side-menu-profile-name');
    dom.sideMenuSubscriptionStatus = document.getElementById('side-menu-subscription-status');
    dom.sideMenuExpiryDate = document.getElementById('side-menu-expiry-date');
    dom.heroStartQuizBtn = document.getElementById('hero-start-quiz-btn');
    dom.homeCustomQuizCard = document.getElementById('home-custom-quiz-card');
    dom.homeContentCreationCard = document.getElementById('home-content-creation-card');
    dom.homeUserGuideCard = document.getElementById('home-user-guide-card');
    // Side Menu Links
    dom.sideMenuSettingsLink = document.getElementById('side-menu-settings-link');
    dom.sideMenuQuizlmLink = document.getElementById('side-menu-quizlm-link');
    dom.sideMenuPaidCourseLink = document.getElementById('side-menu-paid-course-link');
    dom.sideMenuUserGuideLink = document.getElementById('side-menu-user-guide-link');
    dom.sideMenuAboutUsLink = document.getElementById('side-menu-about-us-link');
    dom.sideMenuPrivacyLink = document.getElementById('side-menu-privacy-link');
    
    // NEW: Content Modals
    dom.aboutUsOverlay = document.getElementById('about-us-overlay');
    dom.aboutUsCloseBtn = document.getElementById('about-us-close-btn');
    dom.userGuideOverlay = document.getElementById('user-guide-overlay');
    dom.userGuideCloseBtn = document.getElementById('user-guide-close-btn');
    dom.paidServicesOverlay = document.getElementById('paid-services-overlay');
    dom.paidServicesCloseBtn = document.getElementById('paid-services-close-btn');
    
    // Plan Cards and Buttons for dynamic modal
    dom.freePlanCard = document.querySelector('.plan-card[data-plan="free"]');
    dom.sparkPlanCard = document.querySelector('.plan-card[data-plan="spark"]');
    dom.proPlanCard = document.querySelector('.plan-card[data-plan="pro"]');
    dom.freePlanButton = document.getElementById('free-plan-btn');
    dom.sparkPlanButton = document.getElementById('spark-plan-btn');
    dom.proPlanButton = document.getElementById('pro-plan-btn');


    // Loading Overlays
    dom.loadingOverlay = document.getElementById('loading-overlay');
    dom.loadingText = document.getElementById('loading-text');
    dom.paymentProcessingOverlay = document.getElementById('payment-processing-overlay');

    // PPT Loading Overlay
    dom.pptLoadingOverlay = document.getElementById('ppt-loading-overlay');
    dom.pptLoadingText = document.getElementById('ppt-loading-text');
    dom.pptLoadingProgressBar = document.getElementById('ppt-loading-progress-bar');
    dom.pptLoadingDetails = document.getElementById('ppt-loading-details');
    
    // PDF Loading Overlay
    dom.pdfLoadingOverlay = document.getElementById('pdf-loading-overlay');
    dom.pdfLoadingText = document.getElementById('pdf-loading-text');
    dom.pdfLoadingProgressBar = document.getElementById('pdf-loading-progress-bar');
    dom.pdfLoadingDetails = document.getElementById('pdf-loading-details');
    dom.pdfRenderContainer = document.getElementById('pdf-render-container');

    // Filter Section
    dom.filterSection = document.getElementById('filter-section');
    dom.backToHomeLink = document.getElementById('back-to-home-link');
    dom.tabButtons = document.querySelectorAll('.tab-btn');
    dom.tabPanels = document.querySelectorAll('.tab-panel');
    dom.tabTaglines = document.querySelectorAll('.tagline');
    const filterKeys = ['subject', 'topic', 'subTopic', 'difficulty', 'questionType', 'examName', 'examYear', 'tags'];
    filterKeys.forEach(key => {
        dom.filterElements[key] = {
            container: document.getElementById(`${key}-multiselect-container`),
            toggleBtn: document.getElementById(`${key}-toggle-btn`),
            dropdown: document.getElementById(`${key}-dropdown`),
            searchInput: document.getElementById(`${key}-search-input`),
            list: document.getElementById(`${key}-list`),
            segmentedControl: document.getElementById(`${key}-segmented-control`),
        };
    });
    dom.startQuizBtn = document.getElementById('start-quiz-btn');
    dom.createPptBtn = document.getElementById('create-ppt-btn');
    dom.createPdfBtn = document.getElementById('create-pdf-btn');
    dom.downloadJsonBtn = document.getElementById('download-json-btn');
    dom.resetFiltersBtnQuiz = document.getElementById('reset-filters-btn-quiz');
    dom.resetFiltersBtnPpt = document.getElementById('reset-filters-btn-ppt');
    dom.resetFiltersBtnJson = document.getElementById('reset-filters-btn-json');
    dom.questionCount = document.getElementById('question-count');
    dom.pptQuestionCount = document.getElementById('ppt-question-count');
    dom.pdfQuestionCount = document.getElementById('pdf-question-count');
    dom.jsonQuestionCount = document.getElementById('json-question-count');
    dom.quickStartButtons = document.querySelectorAll('.quick-start-btn');
    dom.activeFiltersSummaryBarContainer = document.getElementById('active-filters-summary-bar-container');
    dom.activeFiltersSummaryBar = document.getElementById('active-filters-summary-bar');

    // Quiz Section
    dom.quizMainContainer = document.getElementById("quiz-main-container");
    dom.quizBreadcrumbContainer = document.querySelector('.quiz-breadcrumb-container');
    dom.quizContainer = document.getElementById("quiz-container");
    dom.quizProgressBar = document.getElementById('quiz-progress-bar');
    dom.timerDisplay = document.getElementById("time-left");
    dom.timerElement = document.getElementById('timer');
    dom.timerBar = document.getElementById('timer-bar');
    dom.statusTrackerEl = document.getElementById("status-tracker");
    dom.questionTextEl = document.getElementById("question-text");
    dom.optionsEl = document.getElementById("options");
    dom.nextBtn = document.getElementById("next-btn");
    dom.explanationEl = document.getElementById("explanation");
    dom.sequentialQuestionNumberEl = document.getElementById("sequential-question-number");
    dom.actualQuestionNumberEl = document.getElementById("actual-question-number");
    dom.examNameTag = document.getElementById('exam-name-tag');
    dom.examDateShiftTag = document.getElementById('exam-date-shift-tag');
    dom.timeoutOverlay = document.getElementById("timeout-overlay");
    dom.lifelineBtn = document.getElementById("lifeline-btn");
    dom.quizSection = document.getElementById("quiz-section");
    dom.finalScoreSection = document.getElementById("final-score-section");
    dom.reviewSection = document.getElementById("review-section");
    dom.scoreSummaryListEl = document.getElementById("score-summary-list");
    dom.reviewQuestionNumberEl = document.getElementById("review-question-number");
    dom.reviewTimeTakenEl = document.getElementById("review-time-taken");
    dom.reviewQuestionTextEl = document.getElementById("review-question-text");
    dom.reviewOptionsEl = document.getElementById("review-options");
    dom.reviewExplanationEl = document.getElementById("review-explanation");
    dom.reviewStatusTrackerEl = document.getElementById("review-status-tracker");
    dom.prevReviewBtn = document.getElementById("prev-review-btn");
    dom.nextReviewBtn = document.getElementById("next-review-btn");
    dom.backToSummaryBtn = document.getElementById("back-to-summary-btn");
    dom.muteBtnReview = document.getElementById("mute-btn-review");
    dom.correctSound = document.getElementById("correct-sound");
    dom.wrongSound = document.getElementById("wrong-sound");
    dom.navMenuIcon = document.getElementById('nav-menu-icon');
    dom.navigationPanel = document.getElementById('navigation-panel');
    dom.navOverlay = document.getElementById('nav-overlay');
    dom.restartFullQuizBtn = document.getElementById('restart-full-quiz-btn');
    dom.restartBtn = document.getElementById('restart-btn');
    dom.reviewBtn = document.getElementById('review-btn');
    dom.aiExplainerBtn = document.getElementById('ai-explainer-btn');
    dom.aiExplanationOverlay = document.getElementById('ai-explanation-overlay');
    dom.aiExplanationCloseBtn = document.getElementById('ai-explanation-close-btn');
    dom.aiExplanationBody = document.getElementById('ai-explanation-body');
    dom.fullscreenBtn = document.getElementById('fullscreen-btn');
    dom.quizNavBar = document.getElementById('quiz-nav-bar');
    dom.prevQuestionBtn = document.getElementById('prev-question-btn');
    dom.nextQuestionBtn = document.getElementById('next-question-btn');
    dom.markReviewBtn = document.getElementById('mark-review-btn');
    dom.shareResultsBtn = document.getElementById('share-results-btn');
    dom.scoreVisualsContainer = document.getElementById('score-visuals-container');
    dom.donutChartContainer = document.getElementById('score-donut-chart-container');
    dom.accuracyProgressBar = document.getElementById('accuracy-progress-bar');
    dom.completionProgressBar = document.getElementById('completion-progress-bar');
    dom.accuracyPercentage = document.getElementById('accuracy-percentage');
    dom.completionPercentage = document.getElementById('completion-percentage');
    
    // Collapsible Header
    dom.quizHeaderBar = document.querySelector('.quiz-header-bar');
    dom.toggleHeaderBtn = document.getElementById('toggle-header-btn');
    dom.collapsibleHeaderContent = document.getElementById('collapsible-header-content');
    
    // Settings & Bookmarks
    dom.quizSettingsBtn = document.getElementById('quiz-settings-btn');
    dom.quizSettingsOverlay = document.getElementById('quiz-settings-overlay');
    dom.quizSettingsPanel = document.getElementById('quiz-settings-panel');
    dom.quizSettingsCloseBtn = document.getElementById('quiz-settings-close-btn');
    dom.profileSettingsOverlay = document.getElementById('profile-settings-overlay');
    dom.profileSettingsPanel = document.getElementById('profile-settings-panel');
    dom.profileSettingsCloseBtn = document.getElementById('profile-settings-close-btn');

    dom.darkModeToggle = document.getElementById('dark-mode-toggle');
    dom.soundToggle = document.getElementById('sound-toggle');
    dom.shuffleToggle = document.getElementById('shuffle-toggle');
    dom.animationsToggle = document.getElementById('animations-toggle');
    dom.hapticToggle = document.getElementById('haptic-toggle');
    dom.bookmarkBtn = document.getElementById('bookmark-btn');
    dom.userEmailDisplay = document.getElementById('user-email-display');
    dom.deleteAccountBtn = document.getElementById('delete-account-btn');

    // Dynamic Headers
    dom.dynamicBreadcrumb = document.getElementById('dynamic-breadcrumb');
    dom.quizTitle = document.getElementById('quiz-title');
    dom.scoreTitle = document.getElementById('score-title');
    dom.reviewTitle = document.getElementById('review-title');
  
}