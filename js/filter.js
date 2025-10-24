import { config, state } from './state.js';
import { dom } from './dom.js';
import { debounce, shuffleArray } from './utils.js';
import { supabase } from './supabaseClient.js';
import * as auth from './auth.js';

let appCallbacks = {};
let docWorker = null;
let classificationHierarchy = {}; // To store subject -> topic -> subTopic relations
let areFilterListenersBound = false; // <-- ADD THIS LINE
/**
 * Triggers a "pop" animation on a given element to provide visual feedback.
 * @param {HTMLElement} element The element to animate.
 */
function triggerCountAnimation(element) {
    if (!element) return;
    
    element.classList.remove('count-updated');
    requestAnimationFrame(() => {
        element.classList.add('count-updated');
    });
}

/**
 * Checks if the user can perform a query (start quiz, generate doc).
 * Increments the user's query count if they are not on a Pro plan and are within limits.
 * @returns {Promise<boolean>} True if the user can proceed, false otherwise.
 */
async function handleQueryAttempt() {
    const profile = state.userProfile;
    if (!profile || profile.subscription_status === 'pro') {
        return true; 
    }

    const isSpark = profile.subscription_status === 'spark';
    const limits = isSpark ? config.sparkPlanLimits : config.freePlanLimits;
    const planName = isSpark ? 'Spark' : 'Free';

    if (profile.daily_queries_used >= limits.queries) {
        Swal.fire({
            target: dom.filterSection,
            title: `Daily Query Limit Reached for ${planName} Plan`,
            html: `You have used your <b>${limits.queries}</b> queries for today. <br>Upgrade to a higher plan for more!`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: 'var(--primary-color)',
            cancelButtonColor: 'var(--wrong-color)',
            confirmButtonText: '<i class="fas fa-dollar-sign"></i> View Plans',
            cancelButtonText: 'Maybe Later'
        }).then((result) => {
            if (result.isConfirmed && appCallbacks.openPaidServicesModal) {
                appCallbacks.openPaidServicesModal();
            }
        });
        return false;
    }

    const newCount = profile.daily_queries_used + 1;
    const updatedProfile = await auth.updateUserProfile(profile.id, { daily_queries_used: newCount });

    if (updatedProfile) {
        state.userProfile = updatedProfile;
    }
    return true;
}


export function initFilterModule(callbacks) {
    appCallbacks = callbacks;
    initializeTabs();
    bindFilterEventListeners();
    loadQuestionsForFiltering();
    state.callbacks.confirmGoBackToHome = callbacks.confirmGoBackToHome;
    if (window.Worker) {
        docWorker = new Worker('./js/worker.js');
        docWorker.onmessage = (e) => {
            const { type, blob, filename, error, value, details } = e.data;
            const overlayId = e.data.format === 'ppt' ? 'ppt-loading-overlay' : 'pdf-loading-overlay';
            const progressBarId = e.data.format === 'ppt' ? 'ppt-loading-progress-bar' : 'pdf-loading-progress-bar';
            const detailsId = e.data.format === 'ppt' ? 'ppt-loading-details' : 'pdf-loading-details';

            if (type === 'progress') {
                document.getElementById(progressBarId).style.width = `${value}%`;
                document.getElementById(detailsId).textContent = details;
            } else if (type === 'result') {
                document.getElementById(overlayId).style.display = 'none';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else if (type === 'error') {
                document.getElementById(overlayId).style.display = 'none';
                console.error('Worker error:', error);
                Swal.fire({
                    target: dom.filterSection,
                    icon: 'error',
                    title: 'Generation Failed',
                    text: 'An error occurred while creating your document.',
                });
            }
        };
    }
}

function initializeTabs() {
    dom.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetPanelId = button.dataset.tab;
            
            dom.tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            dom.tabPanels.forEach(panel => {
                panel.id === targetPanelId ? panel.classList.add('active') : panel.classList.remove('active');
            });

            dom.tabTaglines.forEach(tagline => {
                tagline.dataset.tab === targetPanelId ? tagline.classList.add('active') : tagline.classList.remove('active');
            });
        });
    });
}

const applyFiltersAndUpdateUIDebounced = debounce(applyFiltersAndUpdateUI, 200);
// In js/filter.js - PASTE THIS CLEAN VERSION BACK IN
// THE NEW, CORRECT bindFilterEventListeners FUNCTION
function bindFilterEventListeners() {
    config.filterKeys.forEach(key => {
        const el = dom.filterElements[key];
        if (el.toggleBtn) {
            // KEEP: This handles opening/closing the dropdown
            el.toggleBtn.addEventListener('click', () => toggleDropdown(key));
            
            // REMOVED: The buggy el.list.addEventListener('click', ...) block is gone.

            // KEEP: This handles the search functionality
            el.searchInput.addEventListener('input', () => filterDropdownList(key));

            // KEEP: This handles closing the dropdown when clicking elsewhere
            document.addEventListener('click', (e) => {
                if (!el.container || !el.container.contains(e.target)) {
                    if (el.dropdown) el.dropdown.style.display = 'none';
                }
            });
        } else if (el.segmentedControl) {
            // REMOVED: The buggy el.segmentedControl.addEventListener('click', ...) block is gone.
        }
    });

    // --- All the other event listeners remain exactly the same ---
    dom.startQuizBtn.addEventListener('click', startQuiz);
    dom.createPptBtn.addEventListener('click', createPPT);
    dom.createPdfBtn.addEventListener('click', createPDF);
    dom.downloadJsonBtn.addEventListener('click', downloadJSON);
    
    const resetAndUpdate = () => {
        resetAllFilters();
        // Use our new orchestrator function
        onFilterStateChange(); 
    };
    dom.resetFiltersBtnQuiz.addEventListener('click', resetAndUpdate);
    dom.resetFiltersBtnPpt.addEventListener('click', resetAndUpdate);
    dom.resetFiltersBtnJson.addEventListener('click', resetAndUpdate);

    dom.quickStartButtons.forEach(button => {
        button.addEventListener('click', () => handleQuickStart(button.dataset.preset));
    });

    dom.activeFiltersSummaryBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-close-btn')) {
            const { key, value } = e.target.dataset;
            removeFilter(key, value);
        }
    });
}

// In your NEW js/filter.js file

// --- REPLACE your toggleDropdown function with this CORRECTED version ---
function toggleDropdown(key) {
    // This part closes all OTHER dropdowns first, which is a good feature from our recent attempts.
    config.filterKeys.forEach(otherKey => {
        if (otherKey !== key) {
            const el = dom.filterElements[otherKey];
            if (el && el.dropdown) {
                el.dropdown.style.display = 'none';
            }
        }
    });

    // This part toggles the one you clicked, using the CORRECT display property.
    const dropdown = dom.filterElements[key].dropdown;
    if (dropdown) {
        // Use 'flex' to match the CSS, not 'block'.
        dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
    }
}

// This is the CORRECT loadQuestionsForFiltering function to use
async function loadQuestionsForFiltering() {
    if (state.allQuestionsMasterList.length > 0) {
        // If data is already here, just refresh the UI
        populateFilterControls();
        onFilterStateChange();
        return;
    }
    
    dom.loadingOverlay.style.display = 'flex';
    dom.loadingText.textContent = 'Loading question bank from Supabase...';
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('subject, topic, subTopic, difficulty, questionType, examName, examYear, tags, id, v1_id, question, question_hi, options, options_hi, correct, explanation')
            .order('v1_id', { ascending: true });

        if (error) throw error;
        state.allQuestionsMasterList = data;
        
        // --- Call our new, reliable functions ---
        populateFilterControls();
        onFilterStateChange(); 

    } catch (error) {
        console.error('Error fetching questions:', error);
        dom.loadingText.textContent = 'Failed to load questions. Please refresh.';
    } finally {
        dom.loadingOverlay.classList.add('fade-out');
        dom.loadingOverlay.addEventListener('transitionend', () => {
            dom.loadingOverlay.style.display = 'none';
        }, { once: true });
    }
}

function buildClassificationHierarchy() {
    const hierarchy = {};
    state.allQuestionsMasterList.forEach(q => {
        const { subject, topic, subTopic } = q;
        if (!subject || !topic) return;

        if (!hierarchy[subject]) {
            hierarchy[subject] = {};
        }
        if (!hierarchy[subject][topic]) {
            hierarchy[subject][topic] = new Set();
        }
        if (subTopic) {
            hierarchy[subject][topic].add(subTopic);
        }
    });
    classificationHierarchy = hierarchy;
}

 // NEW: Replaces populateAllFiltersInitially with the old, robust logic
function populateFilterControls() {
    const questions = state.allQuestionsMasterList;
    const unique = {
        subject: new Set(), topic: new Set(), subTopic: new Set(),
        difficulty: new Set(), questionType: new Set(),
        examName: new Set(), examYear: new Set(), tags: new Set()
    };

    questions.forEach(q => {
        config.filterKeys.forEach(key => {
            const value = q[key];
            if (key === 'tags' && Array.isArray(value)) {
                value.forEach(tag => unique.tags.add(tag));
            } else if (value) {
                unique[key].add(value);
            }
        });
    });

    // This function now handles the HTML creation
    const populateMultiSelect = (filterKey, options) => {
        const listElement = dom.filterElements[filterKey]?.list;
        if (!listElement) return;

        listElement.innerHTML = '';
        options.forEach(opt => {
            // This creates a <label> that wraps the entire row, which is the key to the fix.
            const label = document.createElement('label');
            label.className = 'multiselect-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt;
            // The onchange handler is the correct, simple way to handle clicks
            checkbox.onchange = () => handleSelectionChange(filterKey, opt);
            
            const text = document.createElement('span');
            text.textContent = opt;

            const countSpan = document.createElement('span');
            countSpan.className = 'filter-option-count';

            label.appendChild(checkbox);
            label.appendChild(text);
            label.appendChild(countSpan);
            listElement.appendChild(label);
        });
    };
    
    populateMultiSelect('subject', [...unique.subject].sort());
    
    // Disable dependent dropdowns initially
    dom.filterElements.topic.toggleBtn.disabled = true;
    dom.filterElements.topic.toggleBtn.textContent = "Select a Subject first";
    dom.filterElements.subTopic.toggleBtn.disabled = true;
    dom.filterElements.subTopic.toggleBtn.textContent = "Select a Topic first";

    populateMultiSelect('examName', [...unique.examName].sort());
    populateMultiSelect('examYear', [...unique.examYear].sort((a,b) => b-a));
    populateMultiSelect('tags', [...unique.tags].sort());
    populateSegmentedControl('difficulty', [...unique.difficulty].sort());
    populateSegmentedControl('questionType', [...unique.questionType].sort());
}

// NEW: Helper function from old logic
function populateSegmentedControl(filterKey, options) {
    const container = dom.filterElements[filterKey]?.segmentedControl;
    if (!container) return;
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'segmented-btn';
        btn.dataset.value = opt;
        // The onchange handler for segmented buttons is a direct click
        btn.onclick = () => handleSelectionChange(filterKey, opt);
        
        const text = document.createElement('span');
        text.textContent = opt;
        
        const countSpan = document.createElement('span');
        countSpan.className = 'filter-option-count';

        btn.appendChild(text);
        btn.appendChild(countSpan);
        container.appendChild(btn);
    });
}

// NEW: The core event handler from the old, working logic
function handleSelectionChange(filterKey, value) {
    const selectedValues = state.selectedFilters[filterKey];
    
    // Special handling for segmented controls (single-select behavior within their group)
    if (dom.filterElements[filterKey].segmentedControl) {
        const index = selectedValues.indexOf(value);
        if (index > -1) {
            selectedValues.splice(index, 1); // Deselect if clicked again
        } else {
            selectedValues.push(value); // Select
        }
    } else { // Standard multi-select for dropdowns
        const index = selectedValues.indexOf(value);
        if (index > -1) {
            selectedValues.splice(index, 1);
        } else {
            selectedValues.push(value);
        }
    }

    if (filterKey === 'subject') {
        state.selectedFilters.topic = [];
        state.selectedFilters.subTopic = [];
    } else if (filterKey === 'topic') {
        state.selectedFilters.subTopic = [];
    }

    onFilterStateChange();
}

// NEW: The main orchestrator function from the old logic
function onFilterStateChange() {
    updateDependentFilters();
    applyFiltersAndUpdateUI(); // We'll keep the new name for the main filter/update function
    updateActiveFiltersSummary();
}


function applyFiltersAndUpdateUI() {
    updateSelectedFiltersFromUI();
    
    // --- CASCADING FILTER LOGIC ---
    const selectedSubjects = state.selectedFilters.subject;
    const availableTopics = new Set();
    if (selectedSubjects.length > 0) {
        selectedSubjects.forEach(subject => {
            if (classificationHierarchy[subject]) {
                Object.keys(classificationHierarchy[subject]).forEach(topic => availableTopics.add(topic));
            }
        });
    }
    if (updateDropdownOptions('topic', availableTopics, selectedSubjects.length > 0)) {
        updateSelectedFiltersFromUI(); 
    }

    const selectedTopics = state.selectedFilters.topic;
    const availableSubTopics = new Set();
    if (selectedTopics.length > 0 && selectedSubjects.length > 0) {
        selectedSubjects.forEach(subject => {
            if (classificationHierarchy[subject]) {
                selectedTopics.forEach(topic => {
                    if (classificationHierarchy[subject][topic]) {
                        classificationHierarchy[subject][topic].forEach(subTopic => availableSubTopics.add(subTopic));
                    }
                });
            }
        });
    }
    if (updateDropdownOptions('subTopic', availableSubTopics, selectedTopics.length > 0)) {
        updateSelectedFiltersFromUI();
    }
    
    // --- DYNAMIC COUNTING LOGIC ---
    config.filterKeys.forEach(key => {
        const tempFilters = { ...state.selectedFilters };
        delete tempFilters[key];

        const relevantQuestions = filterQuestions(state.allQuestionsMasterList, tempFilters);
        const counts = new Map();
        relevantQuestions.forEach(q => {
            let value = q[key];
             if (key === 'tags' && Array.isArray(value)) {
                value.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
            } else if (value) {
                counts.set(String(value), (counts.get(String(value)) || 0) + 1);
            }
        });
        updateCountUI(key, counts);
    });

    const finalFilteredList = filterQuestions(state.allQuestionsMasterList, state.selectedFilters);
    state.filteredQuestionsMasterList = finalFilteredList;
    updateQuestionCount(finalFilteredList.length);
    updateActiveFiltersSummary();
}

function updateDropdownOptions(key, availableOptionsSet, isParentSelected) {
    const filterEl = dom.filterElements[key];
    if (!filterEl || !filterEl.list) return false;

    const items = filterEl.list.querySelectorAll('.multiselect-item');
    let hasSelectionChanged = false;

    items.forEach(item => {
        const value = item.dataset.value;
        const checkbox = item.querySelector('input');
        if (availableOptionsSet.has(value) || !isParentSelected) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
            if (checkbox && checkbox.checked) {
                checkbox.checked = false;
                hasSelectionChanged = true;
            }
        }
    });

    if (filterEl.toggleBtn) {
        filterEl.toggleBtn.disabled = !isParentSelected;
        if (!isParentSelected) {
            const keyName = key.replace(/([A-Z])/g, ' $1').toLowerCase();
            filterEl.toggleBtn.textContent = `Select ${keyName}`;
            updateMultiselectToggleText(key);
        }
    }
    return hasSelectionChanged;
}

function updateCountUI(key, countsMap) {
    const filterEl = dom.filterElements[key];
    if (!filterEl) return;
    
    if (filterEl.list) {
        const items = filterEl.list.querySelectorAll('.multiselect-item');
        items.forEach(item => {
            const countEl = item.querySelector('.filter-option-count');
            const value = item.dataset.value;
            const count = countsMap.get(value) || 0;
            if (countEl) countEl.textContent = count;
            
            if (count === 0 && !item.querySelector('input').checked) {
                item.classList.add('disabled');
            } else {
                item.classList.remove('disabled');
            }
        });
    } else if (filterEl.segmentedControl) {
        const buttons = filterEl.segmentedControl.querySelectorAll('.segmented-btn');
        buttons.forEach(button => {
            const countEl = button.querySelector('.filter-option-count');
            const value = button.dataset.value;
            const count = countsMap.get(value) || 0;
            if (countEl) countEl.textContent = `(${count})`;

            if (count === 0 && !button.classList.contains('active')) {
                button.disabled = true;
            } else {
                button.disabled = false;
            }
        });
    }
}

function filterQuestions(questions, filters) {
    return questions.filter(q => {
        for (const key in filters) {
            const selected = filters[key];
            if (selected.length === 0) continue;
            
            const questionValue = q[key];
            if (key === 'tags' && Array.isArray(questionValue)) {
                if (!selected.some(tag => questionValue.includes(tag))) {
                    return false;
                }
            } else {
                if (!selected.includes(String(questionValue))) {
                    return false;
                }
            }
        }
        return true;
    });
}



function filterDropdownList(key) {
    const { searchInput, list } = dom.filterElements[key];
    const filter = searchInput.value.toLowerCase();
    list.querySelectorAll('.multiselect-item').forEach(item => {
        const label = item.querySelector('label').textContent.toLowerCase();
        const isSelected = item.querySelector('input').checked;
        const isVisible = item.style.display !== 'none';
        
        if (isVisible) {
             item.style.display = (label.includes(filter) || isSelected) ? '' : 'none';
        }
    });
}

function updateSelectedFiltersFromUI() {
    config.filterKeys.forEach(key => {
        state.selectedFilters[key] = [];
        const filterEl = dom.filterElements[key];

        if (filterEl.toggleBtn && filterEl.toggleBtn.disabled) {
            return;
        }

        if (filterEl.list) {
            filterEl.list.querySelectorAll('input:checked').forEach(input => {
                state.selectedFilters[key].push(input.value);
            });
        } else if (filterEl.segmentedControl) {
            filterEl.segmentedControl.querySelectorAll('.segmented-btn.active').forEach(button => {
                state.selectedFilters[key].push(button.dataset.value);
            });
        }
    });
}

function updateQuestionCount(count) {
    const countElements = [dom.questionCount, dom.pptQuestionCount, dom.pdfQuestionCount, dom.jsonQuestionCount];
    countElements.forEach(el => {
        if (el) {
            el.textContent = count;
            triggerCountAnimation(el);
        }
    });
    
    dom.startQuizBtn.disabled = count === 0;
    dom.createPptBtn.disabled = count === 0;
    dom.createPdfBtn.disabled = count === 0;
    dom.downloadJsonBtn.disabled = count === 0;
}

function updateMultiselectToggleText(key) {
    const { toggleBtn } = dom.filterElements[key];
    if (!toggleBtn) return;
    const selected = state.selectedFilters[key];
    const keyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    if (selected.length === 0) {
        toggleBtn.textContent = `Select ${keyName}`;
    } else if (selected.length === 1) {
        toggleBtn.textContent = selected[0];
    } else {
        toggleBtn.textContent = `${selected.length} ${keyName} selected`;
    }
}

function updateActiveFiltersSummary() {
    dom.activeFiltersSummaryBar.innerHTML = '';
    let hasFilters = false;
    config.filterKeys.forEach(key => {
        if (state.selectedFilters[key] && state.selectedFilters[key].length > 0) {
            hasFilters = true;
            state.selectedFilters[key].forEach(value => {
                const tag = document.createElement('div');
                tag.className = 'filter-tag';
                tag.innerHTML = `${value} <button class="tag-close-btn" data-key="${key}" data-value="${value}">&times;</button>`;
                dom.activeFiltersSummaryBar.appendChild(tag);
            });
        }
    });
    dom.activeFiltersSummaryBarContainer.style.display = hasFilters ? 'block' : 'none';
}

function removeFilter(key, value) {
    const filterEl = dom.filterElements[key];
    if (filterEl.list) {
        const checkbox = filterEl.list.querySelector(`input[value="${CSS.escape(value)}"]`);
        if (checkbox) checkbox.checked = false;
    } else if (filterEl.segmentedControl) {
        const button = filterEl.segmentedControl.querySelector(`[data-value="${CSS.escape(value)}"]`);
        if (button) button.classList.remove('active');
    }
    applyFiltersAndUpdateUIDebounced();
    updateMultiselectToggleText(key);
}

function resetAllFilters() {
    config.filterKeys.forEach(key => {
        state.selectedFilters[key] = [];
        const filterEl = dom.filterElements[key];
        if (filterEl.list) {
            filterEl.list.querySelectorAll('input:checked').forEach(input => input.checked = false);
            updateMultiselectToggleText(key);
        } else if (filterEl.segmentedControl) {
            filterEl.segmentedControl.querySelectorAll('.active').forEach(button => button.classList.remove('active'));
        }
    });
}

function handleQuickStart(preset) {
    resetAllFilters();
    if (preset !== 'quick_25_mix') {
        const difficultyMap = {
            'quick_25_easy': 'Easy',
            'quick_25_moderate': 'Medium',
            'quick_25_hard': 'Hard'
        };
        const difficulty = difficultyMap[preset];
        const btn = dom.filterElements['difficulty'].segmentedControl.querySelector(`[data-value="${difficulty}"]`);
        if (btn) btn.classList.add('active');
    }
    
    applyFiltersAndUpdateUI();

    setTimeout(() => {
        let questionsForQuiz = [...state.filteredQuestionsMasterList];
        if (questionsForQuiz.length > 25) {
            shuffleArray(questionsForQuiz);
            state.filteredQuestionsMasterList = questionsForQuiz.slice(0, 25);
        }
        startQuiz(true);
    }, 250);
}

// In js/filter.js

async function startQuiz(isQuickStart = false) {
    if (state.filteredQuestionsMasterList.length === 0) {
        Swal.fire({ target: dom.filterSection, icon: 'error', title: 'No questions found for the selected filters.' });
        return;
    }

    // --- NEW LOGIC: Show loading state on the button ---
    dom.startQuizBtn.classList.add('loading');
    dom.startQuizBtn.disabled = true;

    try {
        if (!isQuickStart) {
            const canProceed = await handleQueryAttempt();
            if (!canProceed) {
                dom.startQuizBtn.classList.remove('loading'); // Stop loading on failure
                dom.startQuizBtn.disabled = false;
                return;
            }
        }

        // 1. Get User ID
        const userId = state.userProfile?.id;
        if (!userId) {
            throw new Error("User is not authenticated. Cannot start quiz.");
        }

        // 2. Calculate the next attempt number for this user
        const { count, error: countError } = await supabase
            .from('quiz_attempts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) {
            throw new Error(`Could not count previous attempts: ${countError.message}`);
        }
        const attemptNumber = (count || 0) + 1;

        // 3. Prepare the data for the new quiz attempt record
        const questionIds = state.filteredQuestionsMasterList.map(q => q.id);
        const newAttemptData = {
            user_id: userId,
            attempt_number: attemptNumber,
            status: 'in-progress',
            filter_criteria: state.selectedFilters,
            questions_list: questionIds,
            total_questions: questionIds.length
        };

        // 4. INSERT the new record into the database
        const { data: newAttempt, error: insertError } = await supabase
            .from('quiz_attempts')
            .insert(newAttemptData)
            .select()
            .single();

        if (insertError) {
            throw new Error(`Failed to create quiz attempt record: ${insertError.message}`);
        }

        // 5. SUCCESS: Store the new attempt's ID and start the quiz UI
        state.currentAttemptId = newAttempt.id; // <-- CRITICAL STEP
        console.log(`New quiz attempt created with ID: ${state.currentAttemptId}`);

        if (appCallbacks.startQuiz) {
            appCallbacks.startQuiz();
        }

    } catch (error) {
        console.error("Error starting quiz:", error);
        Swal.fire({
            target: dom.filterSection,
            icon: 'error',
            title: 'Could Not Start Quiz',
            text: 'There was a problem communicating with the database. Please try again.'
        });
    } finally {
        // --- NEW LOGIC: Always remove loading state ---
        dom.startQuizBtn.classList.remove('loading');
        // The button will be re-enabled or disabled based on question count in applyFiltersAndUpdateUI
    }
}

async function createPPT() {
    if (docWorker && state.filteredQuestionsMasterList.length > 0) {
        const canProceed = await handleQueryAttempt();
        if (!canProceed) return;
        
        dom.pptLoadingOverlay.style.display = 'flex';
        dom.pptLoadingProgressBar.style.width = '0%';
        dom.pptLoadingDetails.textContent = 'Preparing questions...';

        docWorker.postMessage({
            type: 'generate',
            format: 'ppt',
            questions: state.filteredQuestionsMasterList,
            selectedFilters: state.selectedFilters
        });
    }
}

async function createPDF() {
    if (docWorker && state.filteredQuestionsMasterList.length > 0) {
        const canProceed = await handleQueryAttempt();
        if (!canProceed) return;

        dom.pdfLoadingOverlay.style.display = 'flex';
        dom.pdfLoadingProgressBar.style.width = '0%';
        dom.pdfLoadingDetails.textContent = 'Preparing questions...';

        docWorker.postMessage({
            type: 'generate',
            format: 'pdf',
            questions: state.filteredQuestionsMasterList,
            selectedFilters: state.selectedFilters
        });
    }
}

async function downloadJSON() {
    if (state.filteredQuestionsMasterList.length > 0) {
        const canProceed = await handleQueryAttempt();
        if (!canProceed) return;
        
        const dataStr = JSON.stringify(state.filteredQuestionsMasterList, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quiz_lm_questions.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
