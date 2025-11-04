/* ======================================================= */
/* ====== MAIN APP CONTROLLER FOR MODULAR QUIZ APP ======= */
/* ======================================================= */

// Import all modules
import { config, state, loadSettings, saveSettings, loadQuizState, clearQuizState } from './js/state.js';
import { dom, cacheDomElements } from './js/dom.js';
import * as auth from './js/auth.js';
import { Toast } from './js/utils.js';
import { initializeAllFireballs_anim, animateFireballs_anim } from './js/animations.js';
import { 
    applyInitialSettings, 
    toggleQuizSettings,
    toggleProfileSettings,
    toggleDarkMode, 
    toggleMute, 
    toggleShuffle, 
    toggleAnimations, 
    toggleHapticFeedback,
    zoomIn,
    zoomOut,
    toggleFullScreen,
    hideAIExplanation
} from './js/settings.js';
import { initFilterModule } from './js/filter.js';
import { initQuizModule, loadQuiz, resumeLoadedQuiz } from './js/quiz.js';
import { initReviewModule, showFinalScoreScreen } from './js/review.js';
import { supabase } from './js/supabaseClient.js';

// --- VIEW MANAGER ---
const mainSections = [
    'loginGate', 'homepageSection', 'filterSection', 'quizMainContainer', 
    'quizBreadcrumbContainer', 'finalScoreSection', 'reviewSection'
];
const modalOverlays = [
    'sideMenuOverlay', 'quizSettingsOverlay', 'profileSettingsOverlay', 'privacyPolicyOverlay',
    'aboutUsOverlay', 'userGuideOverlay', 'paidServicesOverlay'
];


/**
 * Hides all main application sections and shows only the specified one.
 * @param {string} viewId The ID of the section to show (e.g., 'homepage-section').
 * @param {object} [options={}] Optional parameters for the view.
 * @param {string} [options.mode] Special mode for a view, e.g., 'quiz' for filterSection.
 */
function showView(viewId, options = {}) {
    mainSections.forEach(key => {
        const element = document.getElementById(key.replace('Section', '-section'));
        if (dom[key] && dom[key].style) {
            dom[key].style.display = 'none';
        }
    });

    // BUG FIX 3: Reset body class to remove special quiz layout styles
    document.body.classList.remove('quiz-active-view');

    const targetElement = document.getElementById(viewId);
    if (targetElement) {
        // Special display types for certain sections
        if (viewId === 'login-gate') {
            targetElement.style.display = 'flex';
        } else if (viewId === 'quiz-main-container') {
            targetElement.style.display = 'block';
            if (dom.quizBreadcrumbContainer) dom.quizBreadcrumbContainer.style.display = 'block';
            // BUG FIX 3: Add a class to the body to fix mobile layout issues
            document.body.classList.add('quiz-active-view');
        } else {
            targetElement.style.display = 'block';
        }
    }

    // --- NEW LOGIC: Conditionally show/hide tabs on filter page ---
    if (viewId === 'filter-section') {
        const pptTab = document.querySelector('.tab-btn[data-tab="ppt-panel"]');
        const jsonTab = document.querySelector('.tab-btn[data-tab="json-panel"]');
        const quizTab = document.querySelector('.tab-btn[data-tab="quiz-panel"]');

        // Initialize the filter module when filter section becomes visible
        try {
            initFilterModule({
                confirmGoBackToHome: () => showView('homepage-section'),
                openPaidServicesModal: () => {
                    const paidModal = document.getElementById('paid-services-overlay');
                    if (paidModal) paidModal.style.display = 'flex';
                }
            });
        } catch (err) {
            console.error('Error initializing filter module:', err);
        }


        if (options.mode === 'quiz') {
            // Quiz-only mode: Hide premium tabs
            if (pptTab) pptTab.style.display = 'none';
            if (jsonTab) jsonTab.style.display = 'none';
            
            // Ensure the quiz tab is selected as it's the only one visible
            if (quizTab && !quizTab.classList.contains('active')) {
                quizTab.click();
            }
        } else { 
            // Default/Content Creation mode: Show all tabs
            if (pptTab) pptTab.style.display = ''; // Reset to default CSS style
            if (jsonTab) jsonTab.style.display = ''; // Reset to default CSS style
        }
    }
}


/**
 * Toggles a modal's visibility with smooth animations.
 * @param {string} modalKey The key of the modal in the `dom` object (e.g., 'aboutUsOverlay').
 * @param {boolean} [forceClose=false] If true, forces the modal to close.
 */
function toggleModal(modalKey, forceClose = false) {
    const modalElement = dom[modalKey];
    if (!modalElement) return;

    const isVisible = modalElement.classList.contains('visible');
    
    if (forceClose || isVisible) {
        modalElement.classList.remove('visible');
        // Let the animation finish before hiding it completely
        setTimeout(() => {
            modalElement.style.display = 'none';
        }, 300);
    } else {
        // Close any other open modals first
        modalOverlays.forEach(key => {
            if (key !== modalKey && dom[key] && dom[key].classList.contains('visible')) {
                toggleModal(key, true);
            }
        });

        modalElement.style.display = 'flex';
        // Allow the browser to render the element before adding the animation class
        setTimeout(() => {
            modalElement.classList.add('visible');
        }, 10);
    }
}

function updatePlansModal() {
    if (!state.userProfile) return;

    const currentPlan = state.userProfile.subscription_status || 'free';
    const plans = {
        free: { card: dom.freePlanCard, button: dom.freePlanButton },
        spark: { card: dom.sparkPlanCard, button: dom.sparkPlanButton },
        pro: { card: dom.proPlanCard, button: dom.proPlanButton }
    };

    // Reset all cards and buttons to their default state
    Object.values(plans).forEach(({ card, button }) => {
        if (!card || !button) return;
        card.classList.remove('current-plan', 'lower-plan');
        button.disabled = false;
    });

    // Set default button text for upgradeable plans
    if (plans.spark.button) plans.spark.button.textContent = 'Upgrade Now';
    if (plans.pro.button) plans.pro.button.textContent = 'Upgrade Now';

    // Configure the card for the user's current plan
    if (plans[currentPlan] && plans[currentPlan].card) {
        plans[currentPlan].card.classList.add('current-plan');
        if (plans[currentPlan].button) {
            plans[currentPlan].button.textContent = 'Your Current Plan';
            plans[currentPlan].button.disabled = true;
        }
    }

    // Disable cards for plans that are lower than the user's current plan
    if (currentPlan === 'spark') {
        if (plans.free.card) plans.free.card.classList.add('lower-plan');
        if (plans.free.button) plans.free.button.disabled = true;
    } else if (currentPlan === 'pro') {
        if (plans.free.card) plans.free.card.classList.add('lower-plan');
        if (plans.free.button) plans.free.button.disabled = true;
        if (plans.spark.card) plans.spark.card.classList.add('lower-plan');
        if (plans.spark.button) plans.spark.button.disabled = true;
    }

    // Special text handling for the free plan button based on its state
    if (plans.free.button) {
        if (currentPlan === 'free') {
            plans.free.button.textContent = 'Selected';
        } else {
            plans.free.button.textContent = 'N/A';
        }
    }
}

/**
 * Updates the user's side menu profile information.
 * @param {object} profile The user profile object from Supabase.
 */
function updateUserProfileUI(profile) {
    if (!profile) return;
    
    dom.sideMenuProfileName.textContent = profile.full_name || 'Quiz User';
    dom.sideMenuProfilePic.src = profile.avatar_url || 'https://via.placeholder.com/60';
    
    const statusBadge = dom.sideMenuSubscriptionStatus;
    const expiryBadge = dom.sideMenuExpiryDate;
    
    statusBadge.classList.remove('pro-plan', 'spark-plan');
    
    let planText = 'Free Plan';
    let hasExpiry = false;

    if (profile.subscription_status === 'pro') {
        planText = 'Pro Plan';
        statusBadge.classList.add('pro-plan');
        hasExpiry = true;
    } else if (profile.subscription_status === 'spark') {
        planText = 'Spark Plan';
        statusBadge.classList.add('spark-plan');
        hasExpiry = true;
    }
    
    statusBadge.textContent = planText;
    
    if (hasExpiry && profile.plan_expiry_date) {
        // FIX: Removed buggy timezone offset logic. `new Date()` automatically
        // converts the UTC string from Supabase to the user's local timezone.
        // `toLocaleDateString()` then formats it correctly for their locale.
        const expiry = new Date(profile.plan_expiry_date);
        expiryBadge.textContent = `Expires on: ${expiry.toLocaleDateString()}`;
        expiryBadge.style.display = 'block';
    } else {
        expiryBadge.style.display = 'none';
    }
}


document.addEventListener('DOMContentLoaded', () => {

    const app = {
        // --- CORE INITIALIZATION ---
        init: function() {
            cacheDomElements();
            this.loadAndApplySettings();
            this.bindGlobalEventListeners();
            this.startBackgroundAnimations();
            
            // Centralized auth state listener
            auth.onAuthStateChange((user) => {
                if (user) {
                    this.showApp(user);
                } else {
                    this.showLoginGate();
                }
            });
        },

        showApp: async function(user) {
            showView('homepage-section');
            
            let profile = await auth.fetchUserProfile(user.id);
            
            // NEW: Check for plan expiry and update profile if needed
            profile = await this.checkPlanExpiry(user.id, profile);
            state.userProfile = profile; // Set the potentially updated profile to state

            if (profile) {
                updateUserProfileUI(profile);
                // NEW: Check and reset daily limits if it's a new day
                await this.checkAndResetDailyLimits(user.id, state.userProfile);

            } else if (user) { // Fallback to auth metadata if profile is somehow missing
                dom.sideMenuProfileName.textContent = user.user_metadata?.full_name || 'Quiz User';
                dom.sideMenuProfilePic.src = user.user_metadata?.avatar_url || 'https://via.placeholder.com/60';
                dom.sideMenuSubscriptionStatus.textContent = 'Free Plan';
                dom.sideMenuSubscriptionStatus.classList.remove('pro-plan', 'spark-plan');
                dom.sideMenuExpiryDate.style.display = 'none';
            }
            
            const wasResumed = await this.promptToResumeQuiz();
            if (wasResumed) return; // Resume logic handles the rest, skip normal init

            // Initialize modules with necessary callbacks to handle transitions
            const callbacks = {
                startQuiz: this.startQuiz.bind(this),
                endQuiz: this.endQuiz.bind(this),
                restartCurrentGroup: this.restartCurrentGroup.bind(this),
                restartFullQuiz: this.restartFullQuiz.bind(this),
                confirmGoBackToHome: this.confirmGoBackToHome.bind(this),
                updateDynamicHeaders: this.updateDynamicHeaders.bind(this),
                openPaidServicesModal: () => {
                    updatePlansModal();
                    toggleModal('paidServicesOverlay');
                },
                toggleQuizInternalNavigation: () => { /* Placeholder, will be populated by quiz module */ },
            };

            // This is a shared state object for callbacks, allowing modules to register their functions.
            state.callbacks = callbacks;

            initFilterModule(callbacks);
            initQuizModule(callbacks);
            initReviewModule(callbacks);
        },
        
        showLoginGate: function() {
            // Hide loading overlay
            if (dom.loadingOverlay.style.display !== 'none') {
                dom.loadingOverlay.classList.add('fade-out');
                dom.loadingOverlay.addEventListener('transitionend', () => {
                    dom.loadingOverlay.style.display = 'none';
                }, { once: true });
            }
            
            showView('login-gate');
            clearQuizState();
            state.userProfile = null; // Clear profile on logout
        
            // --- NEW AUTH FORM LOGIC ---
            const updateSignUpButtonStates = () => {
                const consentGiven = dom.ageConsentCheckbox.checked && dom.privacyConsentCheckbox.checked;
                dom.signUpEmailBtn.disabled = !consentGiven;
                // Disable Google button only when in sign-up mode
                if (dom.signUpTab.classList.contains('active')) {
                    dom.signInBtn.disabled = !consentGiven;
                }
            };
        
            const switchAuthTab = (tabToShow) => {
                const isSignUp = tabToShow === 'sign-up-form';
        
                dom.signInTab.classList.toggle('active', !isSignUp);
                dom.signUpTab.classList.toggle('active', isSignUp);
        
                dom.signInForm.classList.toggle('active', !isSignUp);
                dom.signUpForm.classList.toggle('active', isSignUp);
        
                dom.consentSection.style.display = isSignUp ? 'block' : 'none';
        
                dom.googleBtnText.textContent = isSignUp ? 'Sign up with Google' : 'Sign in with Google';
                dom.signInBtn.disabled = isSignUp ? !(dom.ageConsentCheckbox.checked && dom.privacyConsentCheckbox.checked) : false;
            };
        
            // Event Listeners for new UI
            dom.signInTab.onclick = () => switchAuthTab('sign-in-form');
            dom.signUpTab.onclick = () => switchAuthTab('sign-up-form');
        
            dom.ageConsentCheckbox.onchange = updateSignUpButtonStates;
            dom.privacyConsentCheckbox.onchange = updateSignUpButtonStates;
        
            dom.signInForm.onsubmit = (e) => {
                e.preventDefault();
                const email = dom.signinEmail.value;
                const password = dom.signinPassword.value;
                if (email && password) {
                    auth.signInWithEmail(email, password);
                } else {
                    Toast.fire({ icon: 'warning', title: 'Please enter email and password.' });
                }
            };
        
            dom.signUpForm.onsubmit = (e) => {
                e.preventDefault();
                const fullName = dom.signupName.value;
                const email = dom.signupEmail.value;
                const password = dom.signupPassword.value;
                if (fullName && email && password) {
                    if (password.length < 6) {
                         Toast.fire({ icon: 'warning', title: 'Password must be at least 6 characters.' });
                         return;
                    }
                    auth.signUpWithEmail(fullName, email, password);
                } else {
                     Toast.fire({ icon: 'warning', title: 'Please fill out all fields.' });
                }
            };
        
            // Initial UI State
            switchAuthTab('sign-in-form'); // Default to sign-in view
            updateSignUpButtonStates();
        },

        checkPlanExpiry: async function(userId, profile) {
            if (profile && (profile.subscription_status === 'pro' || profile.subscription_status === 'spark') && profile.plan_expiry_date) {
                const expiryDate = new Date(profile.plan_expiry_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Compare against the start of today

                if (expiryDate < today) {
                    console.log("Paid plan expired. Reverting user to free plan.");
                    const updates = {
                        subscription_status: 'free',
                        plan_expiry_date: null,
                    };
                    const updatedProfile = await auth.updateUserProfile(userId, updates);
                    if (updatedProfile) {
                        Toast.fire({
                            icon: 'info',
                            title: 'Your paid plan has expired.',
                            text: 'You have been switched to the Free plan.'
                        });
                        return updatedProfile; // Return the new, reverted profile
                    }
                }
            }
            return profile; // Return original profile if not expired or not pro
        },
        
        checkAndResetDailyLimits: async function(userId, profile) {
            const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD
            if (profile.last_reset_date !== today) {
                console.log("New day detected. Resetting daily limits for user.");
                const updates = {
                    daily_queries_used: 0,
                    daily_questions_attempted: 0,
                    last_reset_date: today,
                };
                const updatedProfile = await auth.updateUserProfile(userId, updates);
                if (updatedProfile) {
                    state.userProfile = updatedProfile; // Update state with reset values
                    Toast.fire({
                        icon: 'info',
                        title: 'Daily limits have been reset!'
                    });
                }
            }
        },

        promptToResumeQuiz: async function() {
            loadQuizState();
            if (state.isQuizActive && state.questionGroups && state.questionGroups.length > 0) {
                const result = await Swal.fire({
                    title: 'Resume Session?',
                    text: "It looks like you have an unfinished quiz. Would you like to resume where you left off?",
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: 'var(--primary-color)',
                    cancelButtonColor: 'var(--wrong-color)',
                    confirmButtonText: 'Yes, Resume!',
                    cancelButtonText: 'No, Start New'
                });

                if (result.isConfirmed) {
                    this.resumeQuiz();
                    return true;
                } else {
                    clearQuizState();
                    state.isQuizActive = false;
                    state.questionGroups = [];
                    // Load the filter data even if not resuming, so it's ready
                    initFilterModule({startQuiz: this.startQuiz.bind(this)});
                    return false;
                }
            }
            // If no active quiz, still init the filter module in the background
            initFilterModule({startQuiz: this.startQuiz.bind(this)});
            return false;
        },

        loadAndApplySettings: function() {
            loadSettings();
            applyInitialSettings();
        },

        startBackgroundAnimations: function() {
            if (!state.animationsDisabled) {
                if (initializeAllFireballs_anim()) {
                    state.isAnimating = true;
                    animateFireballs_anim();
                }
            }
        },

        // --- SCREEN TRANSITION HANDLERS ---
        startQuiz: function() {
            state.isQuizActive = true;
            showView('quiz-main-container');
            loadQuiz();
            this.updateDynamicHeaders();
        },
        
        resumeQuiz: function() {
            state.isQuizActive = true;
            showView('quiz-main-container');

            // Initialize modules with callbacks for the resumed session
            const callbacks = {
                startQuiz: this.startQuiz.bind(this),
                endQuiz: this.endQuiz.bind(this),
                restartCurrentGroup: this.restartCurrentGroup.bind(this),
                restartFullQuiz: this.restartFullQuiz.bind(this),
                confirmGoBackToHome: this.confirmGoBackToHome.bind(this),
                updateDynamicHeaders: this.updateDynamicHeaders.bind(this),
                openPaidServicesModal: () => {
                    updatePlansModal();
                    toggleModal('paidServicesOverlay');
                },
                toggleQuizInternalNavigation: () => {}, // Placeholder
            };
            state.callbacks = callbacks;
            initQuizModule(callbacks);
            initReviewModule(callbacks);
            
            resumeLoadedQuiz();
            this.updateDynamicHeaders();

            // Also initialize the filter module in the background so data is ready if the user returns to it
            initFilterModule({startQuiz: this.startQuiz.bind(this)});
        },

        endQuiz: function() {
            state.isQuizActive = false;
            dom.quizSection.style.display = 'none';
            dom.reviewSection.style.display = 'none';
            dom.finalScoreSection.style.display = 'block';
            dom.finalScoreSection.classList.add('section-fade-in');
            showFinalScoreScreen();
        },

        restartCurrentGroup: function() {
            // This is handled inside the quiz module, which will re-initialize a group
        },

        restartFullQuiz: function() {
            if (dom.navigationPanel.classList.contains('open')) {
                dom.navigationPanel.classList.remove('open');
                dom.navOverlay.classList.remove('active');
                dom.navMenuIcon.classList.remove('is-active');
            }
        
            document.body.style.overflow = 'auto';
            clearQuizState();
            state.isQuizActive = false;
        
            showView('homepage-section'); // Return to homepage
        
            state.questionGroups = [];
            state.currentGroupIndex = 0;
            state.currentQuizData = null;
        },

        confirmGoBackToHome: function() {
            Swal.fire({
                target: dom.quizMainContainer.style.display === 'block' ? dom.quizMainContainer : dom.filterSection,
                position: 'top',
                title: 'Return to Homepage?',
                text: "Your current progress will be lost if you are in a quiz. This action will start a new session.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'var(--primary-color)',
                cancelButtonColor: 'var(--wrong-color)',
                confirmButtonText: 'Yes, Go Home!'
            }).then((result) => {
                if (result.isConfirmed) {
                    app.restartFullQuiz();
                }
            });
        },
        
        updateDynamicHeaders: function() {
            const groupName = state.currentQuizData?.groupName || "Quiz";

            // Get all active filters from the state
            const activeFilters = [];
            for (const key in state.selectedFilters) {
                if (state.selectedFilters[key] && state.selectedFilters[key].length > 0) {
                    activeFilters.push(...state.selectedFilters[key]);
                }
            }
            
            let filterText = '';
            if (activeFilters.length > 0) {
                // Create the non-clickable, comma-separated list in brackets
                filterText = ` &gt; <span class="breadcrumb-filters">[${activeFilters.join(', ')}]</span>`;
            }

            if (dom.dynamicBreadcrumb) {
                const breadcrumbHtml = `<a href="#" id="breadcrumb-home-link">Home</a> &gt; <a href="#" id="breadcrumb-filters-link">Filters</a> &gt; <span class="current-topic">${groupName}</span>${filterText}`;
                dom.dynamicBreadcrumb.innerHTML = breadcrumbHtml;
            }
            
            if (dom.quizTitle) dom.quizTitle.textContent = groupName;
            if (dom.scoreTitle) dom.scoreTitle.textContent = `Quiz Result - ${groupName}`;
            if (dom.reviewTitle) dom.reviewTitle.textContent = `Review Answer - ${groupName}`;
        },

        // --- SIDE MENU (REFACTORED FOR BUG FIX) ---
        toggleSideMenu: function() {
            const isVisible = dom.sideMenuOverlay.classList.contains('visible');
            if (isVisible) {
                this.closeSideMenu();
            } else {
                this.openSideMenu();
            }
        },

        openSideMenu: function() {
            dom.sideMenuOverlay.classList.add('visible');
            dom.hamburgerMenuBtn.classList.add('is-active');
        },

        closeSideMenu: function() {
            dom.sideMenuOverlay.classList.remove('visible');
            dom.hamburgerMenuBtn.classList.remove('is-active');
        },


        // --- GLOBAL EVENT BINDING ---
        bindGlobalEventListeners: function() {
            // Auth Buttons
            dom.signInBtn.onclick = () => auth.signInWithGoogle();
            dom.logoutBtn.onclick = () => auth.signOut();
            dom.deleteAccountBtn.onclick = () => auth.deleteAccount();
            
            // Bug Fix 1: Centralize quiz nav menu listener
            dom.navMenuIcon.onclick = () => {
                if (state.callbacks.toggleQuizInternalNavigation) {
                    state.callbacks.toggleQuizInternalNavigation();
                }
            };

            // Homepage Navigation
            const goToFilters = () => showView('filter-section', { mode: 'quiz' });
            dom.heroStartQuizBtn.onclick = goToFilters;
            dom.homeCustomQuizCard.onclick = goToFilters;
            
            // New Modal Triggers from Homepage
            dom.homeContentCreationCard.onclick = () => {
                updatePlansModal();
                toggleModal('paidServicesOverlay');
            };
            dom.homeUserGuideCard.onclick = () => toggleModal('userGuideOverlay');
            
            dom.backToHomeLink.onclick = (e) => {
                e.preventDefault();
                showView('homepage-section');
            };

            // Side Menu (Using Refactored Functions)
            dom.hamburgerMenuBtn.onclick = () => this.toggleSideMenu();
            // NOTE: The sideMenuCloseBtn click is now handled by the generic modal logic below
            dom.sideMenuOverlay.onclick = (e) => {
                if (e.target === dom.sideMenuOverlay) this.closeSideMenu();
            };

            // Side Menu Links
            const setupSideMenuLink = (link, action) => {
                if (link) {
                    link.onclick = (e) => {
                        e.preventDefault();
                        this.closeSideMenu();
                        action();
                    };
                }
            };

            setupSideMenuLink(dom.sideMenuQuizlmLink, () => showView('filter-section', { mode: 'quiz' }));
            setupSideMenuLink(dom.sideMenuPaidCourseLink, () => {
                updatePlansModal();
                toggleModal('paidServicesOverlay');
            });
            setupSideMenuLink(dom.sideMenuUserGuideLink, () => toggleModal('userGuideOverlay'));
            setupSideMenuLink(dom.sideMenuAboutUsLink, () => toggleModal('aboutUsOverlay'));
            setupSideMenuLink(dom.sideMenuSettingsLink, async () => {
                const user = await auth.getCurrentUser();
                if (user && user.email) {
                    dom.userEmailDisplay.textContent = user.email;
                } else {
                    dom.userEmailDisplay.textContent = 'Not available';
                }
                toggleProfileSettings(false);
            });
            setupSideMenuLink(dom.sideMenuPrivacyLink, () => toggleModal('privacyPolicyOverlay'));

            // Real Payment Flow with Razorpay
            const handleUpgrade = async (plan, price) => {
                const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
                
                // 1. Show processing overlay and create a payment order on the backend
                dom.paymentProcessingOverlay.querySelector('#payment-processing-text').textContent = 'Creating secure payment order...';
                dom.paymentProcessingOverlay.style.display = 'flex';
                
                const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
                    body: { amount: price * 100, plan: plan }, // Send amount in paise
                });

                if (orderError) {
                    dom.paymentProcessingOverlay.style.display = 'none';
                    Swal.fire('Error', 'Could not create a payment order. Please try again.', 'error');
                    console.error('Order creation error:', orderError);
                    return;
                }
                
                // 2. Configure and open Razorpay Checkout
                const options = {
                    key: orderData.key_id,
                    amount: orderData.amount,
                    currency: "INR",
                    name: "Quiz LM Upgrade",
                    description: `${planName} Plan - Monthly Subscription`,
                    order_id: orderData.id,
                    handler: async function (response) {
                        // 3. Verification step
                        dom.paymentProcessingOverlay.querySelector('#payment-processing-text').textContent = 'Verifying your payment...';
                        dom.paymentProcessingOverlay.style.display = 'flex';

                        const { data: verificationData, error: verificationError } = await supabase.functions.invoke('verify-razorpay-payment', {
                            body: {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                plan: plan,
                            },
                        });

                        dom.paymentProcessingOverlay.style.display = 'none';

                        if (verificationError || !verificationData.success) {
                             Swal.fire('Payment Failed', 'Your payment could not be verified. If the amount was debited, please contact support.', 'error');
                        } else {
                            // 4. Success - Update UI
                            state.userProfile = await auth.fetchUserProfile(state.userProfile.id); // Refresh profile
                            updateUserProfileUI(state.userProfile);
                            updatePlansModal(); // Re-render the modal with new plan
                            toggleModal('paidServicesOverlay', true); // Close the modal
                            Swal.fire(
                                'Upgrade Successful!',
                                `You are now on the ${planName} Plan. Enjoy your new benefits!`,
                                'success'
                            );
                        }
                    },
                    prefill: {
                        name: state.userProfile?.full_name || "Quiz LM User",
                        email: state.userProfile?.email || "",
                    },
                    theme: {
                        color: "#3f51b5" // Matches app's primary color
                    }
                };

                dom.paymentProcessingOverlay.style.display = 'none';
                const rzp = new window.Razorpay(options);
                rzp.on('payment.failed', function (response) {
                    Swal.fire('Payment Failed', response.error.description, 'error');
                });
                rzp.open();
            };
            
            if (dom.sparkPlanButton) {
                dom.sparkPlanButton.onclick = (e) => handleUpgrade(e.target.dataset.plan, e.target.dataset.price);
            }
            if (dom.proPlanButton) {
                dom.proPlanButton.onclick = (e) => handleUpgrade(e.target.dataset.plan, e.target.dataset.price);
            }


            // --- Generic Modal Close Logic ---
            modalOverlays.forEach(modalKey => {
                const overlay = dom[modalKey];
                const closeBtnKey = `${modalKey.replace('Overlay', '')}CloseBtn`;
                const closeBtn = dom[closeBtnKey];

                if (overlay) {
                    overlay.onclick = (e) => {
                        if (e.target === overlay) {
                            if (modalKey === 'sideMenuOverlay') this.closeSideMenu();
                            else if (modalKey === 'quizSettingsOverlay') toggleQuizSettings(true);
                            else if (modalKey === 'profileSettingsOverlay') toggleProfileSettings(true);
                            else toggleModal(modalKey, true);
                        }
                    };
                }
                if (closeBtn) {
                     // BUG FIX 1: Add a specific case for the side menu close button
                     closeBtn.onclick = () => {
                         if (modalKey === 'sideMenuOverlay') this.closeSideMenu();
                         else if (modalKey === 'quizSettingsOverlay') toggleQuizSettings(true);
                         else if (modalKey === 'profileSettingsOverlay') toggleProfileSettings(true);
                         else toggleModal(modalKey, true);
                     };
                }
            });
            // Specific logic for legacy privacy modal
            dom.privacyPolicyLink.onclick = (e) => { e.preventDefault(); toggleModal('privacyPolicyOverlay'); };


            // Settings Panels
            dom.quizSettingsBtn.onclick = () => toggleQuizSettings(false);
            dom.darkModeToggle.onchange = () => toggleDarkMode();
            dom.soundToggle.onchange = () => toggleMute();
            dom.shuffleToggle.onchange = () => toggleShuffle();
            dom.animationsToggle.onchange = () => toggleAnimations();
            dom.hapticToggle.onchange = () => toggleHapticFeedback();
            
            // Other global controls
            dom.fullscreenBtn.onclick = () => toggleFullScreen();
            dom.aiExplanationCloseBtn.addEventListener('click', () => hideAIExplanation());
            dom.aiExplanationOverlay.addEventListener('click', (event) => {
                if (event.target === dom.aiExplanationOverlay) {
                    hideAIExplanation();
                }
            });

            // Zoom
            document.getElementById('zoom-in-btn').onclick = () => zoomIn();
            document.getElementById('zoom-out-btn').onclick = () => zoomOut();
            document.getElementById('zoom-in-btn-review').onclick = () => zoomIn();
            document.getElementById('zoom-out-btn-review').onclick = () => zoomOut();
            
            // Before Unload
            window.addEventListener('beforeunload', (event) => {
                if (state.isQuizActive) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            });

            this.addKeyboardListeners();
            this.addSwipeListeners();
        },

        // --- INPUT HANDLERS (KEYBOARD & SWIPE) ---
        handleKeyPress: function(event) {
            const isAnyModalOpen = modalOverlays.some(key => dom[key] && dom[key].classList.contains('visible'));

            if (event.key === 'Escape') {
                if (dom.aiExplanationOverlay && dom.aiExplanationOverlay.classList.contains('visible')) { hideAIExplanation(); return; }
                if (dom.navigationPanel && dom.navigationPanel.classList.contains('open')) { state.callbacks.toggleQuizInternalNavigation(); return; }
                if (isAnyModalOpen) {
                    modalOverlays.forEach(key => {
                        if (dom[key] && dom[key].classList.contains('visible')) {
                             if (key === 'sideMenuOverlay') this.closeSideMenu();
                             else if (key === 'quizSettingsOverlay') toggleQuizSettings(true);
                             else if (key === 'profileSettingsOverlay') toggleProfileSettings(true);
                             else toggleModal(key, true);
                        }
                    });
                    return;
                }
            }

            if (isAnyModalOpen) return; // Prevent quiz actions if a modal is open

            const isQuizActive = dom.quizSection.style.display === 'block';
            const isReviewActive = dom.reviewSection.style.display === 'block';
            const isFinalScoreActive = dom.finalScoreSection.style.display === 'block';

            if (isQuizActive) {
                state.callbacks.quizKeyPressHandler(event);
            } else if (isReviewActive) {
                state.callbacks.reviewKeyPressHandler(event);
            } else if (isFinalScoreActive) {
                state.callbacks.scoreKeyPressHandler(event);
            }
        },

        addKeyboardListeners: function() {
            document.removeEventListener('keydown', this.handleKeyPress);
            document.addEventListener('keydown', this.handleKeyPress.bind(this));
        },

        handleTouchStart: function(event) {
            if (event.target.closest('button, a, #explanation, #review-explanation')) {
                state.touchStartX = 0;
                return;
            }
            state.touchStartX = event.touches[0].clientX;
            state.touchStartY = event.touches[0].clientY;
        },

        handleMouseDown: function(event) {
            if (event.target.closest('button, a, #explanation, #review-explanation')) {
                return;
            }
            state.isMouseDown = true;
            state.touchStartX = event.clientX;
            state.touchStartY = event.clientY;
        },
        
        handleTouchEnd: function(event) {
            if (state.touchStartX === 0) return;
            const touchEndX = event.changedTouches[0].clientX;
            const touchEndY = event.changedTouches[0].clientY;
            this.processSwipe(touchEndX, touchEndY);
        },

        handleMouseUp: function(event) {
            if (!state.isMouseDown) return;
            state.isMouseDown = false;
            const touchEndX = event.clientX;
            const touchEndY = event.clientY;
            this.processSwipe(touchEndX, touchEndY);
        },

        handleMouseLeave: function() {
            if (state.isMouseDown) {
                state.isMouseDown = false;
                state.touchStartX = 0;
                state.touchStartY = 0;
            }
        },
        
        processSwipe: function(touchEndX, touchEndY) {
            if (state.touchStartX === 0) return;
            
            const isAnyModalOpen = modalOverlays.some(key => dom[key] && dom[key].classList.contains('visible'));
            if (isAnyModalOpen || dom.navigationPanel.classList.contains('open')) {
                state.touchStartX = 0;
                state.touchStartY = 0;
                return;
            }

            const deltaX = touchEndX - state.touchStartX;
            const deltaY = touchEndY - state.touchStartY;
            const swipeThreshold = 50;

            if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                const isQuizActive = dom.quizSection.style.display === 'block';
                const isReviewActive = dom.reviewSection.style.display === 'block';
        
                if (deltaX > 0) { // Swipe Right (Previous)
                    if (isQuizActive && state.callbacks.previousQuestionHandler) state.callbacks.previousQuestionHandler();
                    else if (isReviewActive && state.callbacks.navigateReview) state.callbacks.navigateReview(-1);
                } else { // Swipe Left (Next/Skip)
                    if (isQuizActive && state.callbacks.nextQuestionHandler) state.callbacks.nextQuestionHandler();
                    else if (isReviewActive && state.callbacks.navigateReview) state.callbacks.navigateReview(1);
                }
            }
        
            state.touchStartX = 0;
            state.touchStartY = 0;
        },

        addSwipeListeners: function() {
            const swipeAreas = [dom.quizSection, dom.reviewSection];
            swipeAreas.forEach(area => {
                if(area) {
                    area.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
                    area.addEventListener('touchend', this.handleTouchEnd.bind(this));
                    area.addEventListener('mousedown', this.handleMouseDown.bind(this));
                    area.addEventListener('mouseup', this.handleMouseUp.bind(this));
                    area.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
                }
            });
        }
    };

    app.init();
});