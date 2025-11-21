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
