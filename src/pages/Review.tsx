import React, { useEffect, useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { buildExplanationHtml } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export const Review: React.FC = () => {
    const { state } = useQuiz();
    const navigate = useNavigate();

    const [filter, setFilter] = useState<'all'|'correct'|'wrong'|'skipped'|'bookmarked'>('all');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [filteredAttempts, setFilteredAttempts] = useState<any[]>([]);

    const cd = state.currentQuizData;

    useEffect(() => {
        if (!cd) {
            navigate('/');
            return;
        }

        let attempts = [...cd.attempts];
        // Include skipped questions (those not in attempts but in shuffledQuestions)
        const attemptedIds = new Set(attempts.map((a: any) => a.questionId));
        const skipped = cd.shuffledQuestions
            .filter((q: any) => !attemptedIds.has(q.id))
            .map((q: any) => ({
                questionId: q.id, v1_id: q.v1_id,
                question: q.question, question_hi: q.question_hi,
                options: q.options, options_hi: q.options_hi,
                correct: q.correct, status: 'Skipped', explanation: q.explanation
            }));

        // Merge for "all" view or filtered view
        // Note: Legacy code filtered attempts only for Review, but strictly speaking, review should show everything.
        // The legacy code logic: `allAttempts = state.currentQuizData.attempts`.
        // It seems legacy ONLY reviewed attempted questions?
        // Wait, legacy `setReviewFilter` -> 'skipped' case uses `a.status === 'Skipped'`.
        // So skipped questions MUST be in attempts or added to the list.
        // In `checkAnswer` legacy, we push to attempts. Skipped ones are not in attempts array usually unless explicitly added?
        // Ah, legacy `endQuiz` doesn't populate skipped attempts.
        // BUT `displayReviewQuestion` handles "Skipped".

        // Let's build a comprehensive list for review.
        const fullList = [
            ...attempts,
            ...skipped
        ];

        let result = [];
        switch (filter) {
            case 'correct': result = fullList.filter(a => a.status === 'Correct'); break;
            case 'wrong': result = fullList.filter(a => a.status === 'Wrong' || a.status === 'Timeout'); break;
            case 'skipped': result = fullList.filter(a => a.status === 'Skipped'); break;
            case 'bookmarked': result = fullList.filter(a => state.bookmarkedQuestions.includes(a.questionId)); break;
            default: result = fullList; break;
        }
        setFilteredAttempts(result);
        setCurrentIndex(0);

    }, [cd, filter, state.bookmarkedQuestions, navigate]);

    if (!cd) return null;

    const currentReviewItem = filteredAttempts[currentIndex];

    const renderQuestionText = (q: string, qHi?: string) => {
        const clean = (q || "").replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '');
        const cleanHi = (qHi || "").replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '');
        return (
            <>
                {clean}
                {cleanHi && <><hr className="lang-separator"/><span className="hindi-text">{cleanHi}</span></>}
            </>
        );
    };

    return (
        <div id="review-section" style={{display: 'block'}}>
             <h1 id="review-title">Review Answer - {cd.groupName}</h1>
            <div className="quiz-container">
              <div className="controls-area">
                <div className="filter-controls">
                    <span>Filter by:</span>
                    <div className="filter-btn-group">
                        {['all', 'correct', 'wrong', 'skipped', 'bookmarked'].map(f => (
                            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f as any)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
              </div>

              {filteredAttempts.length > 0 && currentReviewItem ? (
                  <div id="review-container" className="review-container">
                      <div id="review-question-number">
                          Reviewing {filter} ({currentIndex + 1}/{filteredAttempts.length}) | ID: {currentReviewItem.v1_id || currentReviewItem.questionId}
                      </div>

                      {currentReviewItem.status === 'Skipped' ?
                        <div id="review-time-taken">(Not Attempted)</div> :
                        <div id="review-time-taken">(Time Taken: {currentReviewItem.timeTaken?.toFixed(1)}s)</div>
                      }

                      <h2 id="review-question-text">
                          {renderQuestionText(currentReviewItem.question, currentReviewItem.question_hi)}
                      </h2>

                      <div id="review-options" className="options">
                          {currentReviewItem.options.map((opt: string, idx: number) => {
                              const optHi = currentReviewItem.options_hi ? currentReviewItem.options_hi[idx] : '';
                              const isCorrect = opt === currentReviewItem.correct;
                              const isSelected = opt === currentReviewItem.selected;

                              let btnClass = '';
                              if (isCorrect) btnClass += ' review-correct';
                              if (isSelected && !isCorrect && currentReviewItem.status !== 'Skipped') btnClass += ' review-selected review-wrong-selected';
                              else if (isSelected) btnClass += ' review-selected'; // Correct selection

                              return (
                                  <button key={idx} className={btnClass} disabled>
                                      {opt}
                                      {optHi && <><br/><span className="hindi-text">{optHi}</span></>}
                                      {isCorrect && <span className="icon-feedback">✔️</span>}
                                      {isSelected && !isCorrect && <span className="icon-feedback">❌</span>}
                                  </button>
                              )
                          })}
                      </div>

                      <div id="review-explanation" style={{display: 'block'}}
                           dangerouslySetInnerHTML={{__html: buildExplanationHtml(currentReviewItem.explanation)}} />
                  </div>
              ) : (
                  <div className="quiz-container"><h2>No questions match the filter "{filter}".</h2></div>
              )}

              <div className="button-group">
                  <button id="prev-review-btn" disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)}>Previous</button>
                  <button id="next-review-btn" disabled={currentIndex === filteredAttempts.length - 1} onClick={() => setCurrentIndex(p => p + 1)}>Next</button>
                  <button id="back-to-summary-btn" onClick={() => navigate('/result')}>Back to Summary</button>
              </div>
         </div>
        </div>
    );
};
