// START OF THE COMPLETE filter.js FILE

import { config, state } from './state.js';
import { dom } from './dom.js';
import { debounce, shuffleArray } from './utils.js';
import { supabase } from './supabaseClient.js';
import * as auth from './auth.js';

let appCallbacks = {};
let docWorker = null;
let classificationHierarchy = {}; // To store subject -> topic -> subTopic relations

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

function populateMultiSelect(filterKey, options) {
    const listElement = dom.filterElements[filterKey]?.list;
    if (!listElement) return;

    const selectedValues = state.selectedFilters[filterKey] || [];
    listElement.innerHTML = '';
    options.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'multiselect-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = opt;
        checkbox.checked = selectedValues.includes(opt);
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
}

function populateSegmentedControl(filterKey, options) {
    const container = dom.filterElements[filterKey]?.segmentedControl;
    if (!container) return;
    container.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'segmented-btn';
        btn.dataset.value = opt;
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

function populateFilterControls() {
    const questions = state.allQuestionsMasterList;
    const unique = {
        subject: new Set(), topic: new Set(), subTopic: new Set(),
        difficulty: new Set(), questionType: new Set(),
        examName: new Set(), examYear: new Set(), tags: new Set()
    };

    // Collect all unique filter values
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

    // Populate main multi-select and segmented controls
    populateMultiSelect('subject', [...unique.subject].sort());
    
    dom.filterElements.topic.toggleBtn.disabled = true;
    dom.filterElements.topic.toggleBtn.textContent = "Select a Subject first";
    dom.filterElements.subTopic.toggleBtn.disabled = true;
    dom.filterElements.subTopic.toggleBtn.textContent = "Select a Topic first";

    populateMultiSelect('examName', [...unique.examName].sort());
    populateMultiSelect('examYear', [...unique.examYear].sort((a,b) => b - a));
    populateMultiSelect('tags', [...unique.tags].sort());
    populateSegmentedControl('difficulty', [...unique.difficulty].sort());
    populateSegmentedControl('questionType', [...unique.questionType].sort());

    // ✅ FIX: Ensure all toggle buttons are properly configured for delegated click events
    Object.keys(dom.filterElements).forEach(key => {
        const el = dom.filterElements[key];
        if (el && el.toggleBtn) {
            el.toggleBtn.classList.add('filter-toggle-btn'); // ensures event delegation works
            el.toggleBtn.dataset.key = key;                  // ensures correct key is attached
        }
    });
}


function handleSelectionChange(filterKey, value) {
    const selectedValues = state.selectedFilters[filterKey];
    const stringValue = String(value);

    const index = selectedValues.indexOf(stringValue);
    if (index > -1) {
        selectedValues.splice(index, 1);
    } else {
        selectedValues.push(stringValue);
    }

    if (filterKey === 'subject') {
        state.selectedFilters.topic = [];
        state.selectedFilters.subTopic = [];
    } else if (filterKey === 'topic') {
        state.selectedFilters.subTopic = [];
    }

    onFilterStateChange();
}

const applyFiltersAndUpdateUIDebounced = debounce(applyFiltersAndUpdateUI, 200);

function onFilterStateChange() {
    updateDependentFilters();
    applyFiltersAndUpdateUIDebounced();
    updateActiveFiltersSummary();
}

function updateDependentFilters() {
    const { subject: selectedSubjects, topic: selectedTopics } = state.selectedFilters;
    const { topic: topicElements, subTopic: subTopicElements } = dom.filterElements;

    if (selectedSubjects.length === 0) {
        topicElements.toggleBtn.disabled = true;
        topicElements.toggleBtn.textContent = "Select a Subject first";
        topicElements.list.innerHTML = '';
        topicElements.toggleBtn.disabled = true;
    } else {
        topicElements.toggleBtn.disabled = false;
        const relevantTopics = new Set();
        state.allQuestionsMasterList.forEach(q => {
            if (q.subject && selectedSubjects.includes(q.subject) && q.topic) {
                relevantTopics.add(q.topic);
            }
        });
        populateMultiSelect('topic', [...relevantTopics].sort());
    }

    if (selectedTopics.length === 0) {
        subTopicElements.toggleBtn.textContent = "Select a Topic first";
        subTopicElements.list.innerHTML = '';
        subTopicElements.toggleBtn.disabled = true;
    } else {
        subTopicElements.toggleBtn.disabled = false;
        const relevantSubTopics = new Set();
        state.allQuestionsMasterList.forEach(q => {
            if (q.subject && selectedSubjects.includes(q.subject) &&
                q.topic && selectedTopics.includes(q.topic) &&
                q.subTopic) {
                relevantSubTopics.add(q.subTopic);
            }
        });
        populateMultiSelect('subTopic', [...relevantSubTopics].sort());
    }
}

/**
 * Toggles the visibility of a dropdown panel and closes others.
 * @param {string} key The filter key for the dropdown to toggle.
 */
function toggleDropdown(key) {
    // Close all other dropdowns first
    config.filterKeys.forEach(otherKey => {
        if (otherKey !== key) {
            const el = dom.filterElements[otherKey];
            if (el && el.dropdown) {
                el.dropdown.style.display = 'none';
            }
        }
    });

    // Toggle the clicked dropdown
const dropdown = dom.filterElements[key]?.dropdown;
if (dropdown) {
  const isVisible = getComputedStyle(dropdown).display === 'flex';
  dropdown.style.display = isVisible ? 'none' : 'flex';

  const parent = dropdown.closest('.custom-multiselect');
  if (parent) {
    parent.classList.toggle('open', !isVisible);
  }
}


    }
}

/**
 * Filters the list of options in a dropdown based on user input.
 * @param {string} key The filter key for the dropdown being searched.
 */
function filterDropdownList(key) {
    const { searchInput, list } = dom.filterElements[key];
    const filter = searchInput.value.toLowerCase();
    list.querySelectorAll('.multiselect-item').forEach(item => {
        const labelText = item.querySelector('span:not(.filter-option-count)').textContent.toLowerCase();
        const checkbox = item.querySelector('input');
        const isSelected = checkbox && checkbox.checked;

        if (labelText.includes(filter) || isSelected) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Handles clicks anywhere on the document to close dropdowns if the click is "outside".
 * @param {MouseEvent} event The click event.
 */
function handleGlobalDropdownClose(event) {
    config.filterKeys.forEach(key => {
        const el = dom.filterElements[key];
        if (el && el.dropdown && el.dropdown.style.display === 'flex') {
            const isClickInsideToggleBtn = el.toggleBtn && el.toggleBtn.contains(event.target);
            const isClickInsideDropdown = el.dropdown && el.dropdown.contains(event.target);

            // If the click was not inside the toggle button OR the dropdown panel, close it.
            if (!isClickInsideToggleBtn && !isClickInsideDropdown) {
                el.dropdown.style.display = 'none';
            }
        }
    });
}

function bindFilterEventListeners() {
    // Add the single, smart global listener.
    document.addEventListener('click', handleGlobalDropdownClose);
// ✅ Delegated event listener for all filter toggle buttons
if (dom.filterSection) {
    dom.filterSection.addEventListener('click', (event) => {
        const toggleBtn = event.target.closest('.filter-toggle-btn');
        if (!toggleBtn) return;  // clicked something else

        // Each toggle button must have its filter key stored in data-key
        const key = toggleBtn.dataset.key;
        if (!key || !dom.filterElements[key]) return;

        // Prevent global close handler
        event.stopPropagation();

        toggleDropdown(key);
    });
}

  

    dom.startQuizBtn.addEventListener('click', startQuiz);
    dom.createPptBtn.addEventListener('click', createPPT);
    dom.createPdfBtn.addEventListener('click', createPDF);
    dom.downloadJsonBtn.addEventListener('click', downloadJSON);
    
    const resetAndUpdate = () => {
        resetAllFilters();
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

async function loadQuestionsForFiltering() {
    if (state.allQuestionsMasterList.length > 0) {
        populateFilterControls();
        onFilterStateChange();
        return;
    }
    
    dom.loadingOverlay.style.display = 'flex';
    dom.loadingText.textContent = 'Loading question bank...';
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('subject, topic, subTopic, difficulty, questionType, examName, examYear, tags, id, v1_id, question, question_hi, options, options_hi, correct, explanation')
            .order('v1_id', { ascending: true });

        if (error) throw error;
        state.allQuestionsMasterList = data;
        
        buildClassificationHierarchy();
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

function applyFiltersAndUpdateUI() {
    config.filterKeys.forEach(key => {
        const tempFilters = JSON.parse(JSON.stringify(state.selectedFilters));
        tempFilters[key] = [];

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
}

function updateCountUI(key, countsMap) {
    const filterEl = dom.filterElements[key];
    if (!filterEl) return;
    
    if (filterEl.list) {
        const items = filterEl.list.querySelectorAll('.multiselect-item');
        items.forEach(item => {
            const countEl = item.querySelector('.filter-option-count');
            const value = item.querySelector('input').value;
            const count = countsMap.get(value) || 0;
            if (countEl) countEl.textContent = `(${count})`;
            
            const checkbox = item.querySelector('input');
            const isDisabled = count === 0 && !checkbox.checked;
            item.classList.toggle('disabled', isDisabled);
            checkbox.disabled = isDisabled;
        });
    } else if (filterEl.segmentedControl) {
        const buttons = filterEl.segmentedControl.querySelectorAll('.segmented-btn');
        buttons.forEach(button => {
            const countEl = button.querySelector('.filter-option-count');
            const value = button.dataset.value;
            const count = countsMap.get(value) || 0;
            if (countEl) countEl.textContent = `(${count})`;
            
            button.classList.toggle('active', state.selectedFilters[key].includes(value));
        });
    }
    updateMultiselectToggleText(key);
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
    if (!toggleBtn || toggleBtn.disabled) return;
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
    const selected = state.selectedFilters[key];
    const index = selected.indexOf(value);
    if (index > -1) {
        selected.splice(index, 1);
    }
    onFilterStateChange();
}

function resetAllFilters() {
    config.filterKeys.forEach(key => {
        state.selectedFilters[key] = [];
    });
    populateFilterControls(); 
    onFilterStateChange();
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
        state.selectedFilters.difficulty.push(difficulty);
    }
    
    onFilterStateChange();

    setTimeout(() => {
        let questionsForQuiz = [...state.filteredQuestionsMasterList];
        if (questionsForQuiz.length > 25) {
            shuffleArray(questionsForQuiz);
            state.filteredQuestionsMasterList = questionsForQuiz.slice(0, 25);
        }
        startQuiz(true);
    }, 250);
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

// END OF THE COMPLETE filter.js FILE
