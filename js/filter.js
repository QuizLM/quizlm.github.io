import { config, state } from './state.js';
import { dom } from './dom.js';
import { debounce, shuffleArray } from './utils.js';
import { supabase } from './supabaseClient.js';
import * as auth from './auth.js';

let appCallbacks = {};
let docWorker = null;

/**
 * Triggers a "pop" animation on a given element to provide visual feedback.
 * @param {HTMLElement} element The element to animate.
 */
function triggerCountAnimation(element) {
    if (!element) return;
    
    // Remove the class first to re-trigger the animation if it was just added
    element.classList.remove('count-updated');
    // We need a short delay to allow the browser to process the removal before re-adding
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

    // Increment the counter
    const newCount = profile.daily_queries_used + 1;
    const updatedProfile = await auth.updateUserProfile(profile.id, { daily_queries_used: newCount });

    if (updatedProfile) {
        state.userProfile = updatedProfile; // Keep local state in sync
    }
    // Optimistically allow the user to proceed even if the update fails
    return true;
}


export function initFilterModule(callbacks) {
    appCallbacks = callbacks;
    initializeTabs();
    bindFilterEventListeners();
    loadQuestionsForFiltering();
    state.callbacks.confirmGoBackToHome = callbacks.confirmGoBackToHome;
     // Initialize the worker
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

const applyAllFiltersDebounced = debounce(applyAllFilters, 300);

function bindFilterEventListeners() {
    config.filterKeys.forEach(key => {
        if (dom.filterElements[key].toggleBtn) {
            setupMultiselect(key);
        } else if (dom.filterElements[key].segmentedControl) {
            setupSegmentedControl(key);
        }
    });

    dom.startQuizBtn.addEventListener('click', startQuiz);
    dom.createPptBtn.addEventListener('click', createPPT);
    dom.createPdfBtn.addEventListener('click', createPDF);
    dom.downloadJsonBtn.addEventListener('click', downloadJSON);

    dom.resetFiltersBtnQuiz.addEventListener('click', resetAllFilters);
    dom.resetFiltersBtnPpt.addEventListener('click', resetAllFilters);
    dom.resetFiltersBtnJson.addEventListener('click', resetAllFilters);

    dom.quickStartButtons.forEach(button => {
        button.addEventListener('click', () => handleQuickStart(button.dataset.preset));
    });
}

async function loadQuestionsForFiltering() {
    if (state.allQuestionsMasterList.length > 0) {
        populateFilterOptions();
        return;
    }
    
    dom.loadingOverlay.style.display = 'flex';
    dom.loadingText.textContent = 'Welcome to QuizLM...';
    try {
        const { data, error } = await supabase.from('questions').select('*').order('v1_id', { ascending: true });
        if (error) throw error;
        // BUG FIX 2: The data from Supabase is already flat. Do not map and spread non-existent nested properties.
        state.allQuestionsMasterList = data;
        populateFilterOptions();
        applyAllFilters();
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

function populateFilterOptions() {
    const uniqueValues = {};
    config.filterKeys.forEach(key => uniqueValues[key] = new Map());

    state.allQuestionsMasterList.forEach(q => {
        config.filterKeys.forEach(key => {
            let value = q[key];
            if (key === 'tags' && Array.isArray(value)) {
                value.forEach(tag => {
                    uniqueValues.tags.set(tag, (uniqueValues.tags.get(tag) || 0) + 1);
                });
            } else if (value) {
                uniqueValues[key].set(value, (uniqueValues[key].get(value) || 0) + 1);
            }
        });
    });

    config.filterKeys.forEach(key => {
        const sortedValues = new Map([...uniqueValues[key].entries()].sort((a, b) => a[0] > b[0] ? 1 : -1));
        const filterEl = dom.filterElements[key];

        if (filterEl.list) {
            filterEl.list.innerHTML = '';
            sortedValues.forEach((count, value) => {
                const item = document.createElement('div');
                item.className = 'multiselect-item';
                item.innerHTML = `
                    <label>
                        <input type="checkbox" value="${value}" data-filter-key="${key}">
                        ${value}
                    </label>
                    <span class="filter-option-count">${count}</span>`;
                filterEl.list.appendChild(item);
            });
        } else if (filterEl.segmentedControl) {
            filterEl.segmentedControl.innerHTML = '';
            sortedValues.forEach((count, value) => {
                const button = document.createElement('button');
                button.className = 'segmented-btn';
                button.dataset.value = value;
                button.dataset.filterKey = key;
                button.innerHTML = `${value} <span class="filter-option-count">(${count})</span>`;
                filterEl.segmentedControl.appendChild(button);
            });
        }
    });
}

function setupMultiselect(key) {
    const el = dom.filterElements[key];
    el.toggleBtn.addEventListener('click', () => toggleDropdown(key));
    el.list.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            updateSelectedFiltersFromUI();
            applyAllFiltersDebounced();
            updateMultiselectToggleText(key);
        }
    });
    el.searchInput.addEventListener('input', () => filterDropdownList(key));
    document.addEventListener('click', (e) => {
        if (!el.container || !el.container.contains(e.target)) {
            if (el.dropdown) el.dropdown.style.display = 'none';
        }
    });
}

function setupSegmentedControl(key) {
    const el = dom.filterElements[key];
    el.segmentedControl.addEventListener('click', (e) => {
        const button = e.target.closest('.segmented-btn');
        if (button) {
            button.classList.toggle('active');
            updateSelectedFiltersFromUI();
            applyAllFiltersDebounced();
        }
    });
}

function toggleDropdown(key) {
    const dropdown = dom.filterElements[key].dropdown;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function filterDropdownList(key) {
    const { searchInput, list } = dom.filterElements[key];
    const filter = searchInput.value.toLowerCase();
    list.querySelectorAll('.multiselect-item').forEach(item => {
        const label = item.querySelector('label').textContent.toLowerCase();
        item.style.display = label.includes(filter) ? '' : 'none';
    });
}

function updateSelectedFiltersFromUI() {
    config.filterKeys.forEach(key => {
        state.selectedFilters[key] = [];
        const filterEl = dom.filterElements[key];

        if (filterEl.list) { // Multiselect
            filterEl.list.querySelectorAll('input:checked').forEach(input => {
                state.selectedFilters[key].push(input.value);
            });
        } else if (filterEl.segmentedControl) { // Segmented Control
            filterEl.segmentedControl.querySelectorAll('.segmented-btn.active').forEach(button => {
                state.selectedFilters[key].push(button.dataset.value);
            });
        }
    });
}

function applyAllFilters() {
    let filtered = [...state.allQuestionsMasterList];
    
    config.filterKeys.forEach(key => {
        const selected = state.selectedFilters[key];
        if (selected.length > 0) {
            filtered = filtered.filter(q => {
                if (key === 'tags' && Array.isArray(q.tags)) {
                    return selected.some(tag => q.tags.includes(tag));
                }
                return selected.includes(q[key]);
            });
        }
    });

    state.filteredQuestionsMasterList = filtered;
    updateQuestionCount(filtered.length);
    updateActiveFiltersSummary();
}

function updateQuestionCount(count) {
    const countElements = [
        dom.questionCount, 
        dom.pptQuestionCount, 
        dom.pdfQuestionCount, 
        dom.jsonQuestionCount
    ];
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
    const selected = state.selectedFilters[key];
    const keyName = key.replace(/([A-Z])/g, ' $1');
    if (selected.length === 0) {
        toggleBtn.textContent = `Select ${keyName}s`;
    } else if (selected.length === 1) {
        toggleBtn.textContent = selected[0];
    } else {
        toggleBtn.textContent = `${selected.length} ${keyName}s selected`;
    }
}

function updateActiveFiltersSummary() {
    dom.activeFiltersSummaryBar.innerHTML = '';
    let hasFilters = false;
    for (const key in state.selectedFilters) {
        if (state.selectedFilters[key].length > 0) {
            hasFilters = true;
            state.selectedFilters[key].forEach(value => {
                const tag = document.createElement('div');
                tag.className = 'filter-tag';
                tag.innerHTML = `${value} <button class="tag-close-btn" data-key="${key}" data-value="${value}">&times;</button>`;
                dom.activeFiltersSummaryBar.appendChild(tag);
            });
        }
    }
    dom.activeFiltersSummaryBarContainer.style.display = hasFilters ? 'block' : 'none';

    dom.activeFiltersSummaryBar.querySelectorAll('.tag-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { key, value } = e.target.dataset;
            removeFilter(key, value);
        });
    });
}

function removeFilter(key, value) {
    const filterEl = dom.filterElements[key];
    if (filterEl.list) {
        const checkbox = filterEl.list.querySelector(`input[value="${value}"]`);
        if (checkbox) checkbox.checked = false;
    } else if (filterEl.segmentedControl) {
        const button = filterEl.segmentedControl.querySelector(`[data-value="${value}"]`);
        if (button) button.classList.remove('active');
    }
    updateSelectedFiltersFromUI();
    applyAllFiltersDebounced();
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
    applyAllFilters();
}

function handleQuickStart(preset) {
    resetAllFilters();
    state.selectedFilters['difficulty'] = [];
    switch (preset) {
        case 'quick_25_easy': state.selectedFilters['difficulty'].push('Easy'); break;
        case 'quick_25_moderate': state.selectedFilters['difficulty'].push('Medium'); break;
        case 'quick_25_hard': state.selectedFilters['difficulty'].push('Hard'); break;
        case 'quick_25_mix': break;
    }
    
    dom.filterElements['difficulty'].segmentedControl.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
    state.selectedFilters['difficulty'].forEach(val => {
        const btn = dom.filterElements['difficulty'].segmentedControl.querySelector(`[data-value="${val}"]`);
        if (btn) btn.classList.add('active');
    });

    applyAllFilters();
    let questionsForQuiz = [...state.filteredQuestionsMasterList];
    if (questionsForQuiz.length > 25) {
        shuffleArray(questionsForQuiz);
        state.filteredQuestionsMasterList = questionsForQuiz.slice(0, 25);
    }
    startQuiz(true);
}

async function startQuiz(isQuickStart = false) {
    if (state.filteredQuestionsMasterList.length === 0) {
        Swal.fire({ target: dom.filterSection, icon: 'error', title: 'No questions found for the selected filters.' });
        return;
    }

    if (!isQuickStart) {
        const canProceed = await handleQueryAttempt();
        if (!canProceed) return;
    }
    
    if (appCallbacks.startQuiz) {
        appCallbacks.startQuiz();
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