import React, { useEffect, useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { buildExplanationHtml } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

declare const html2canvas: any;
declare const Swal: any;

export const Result: React.FC = () => {
    const { state, dispatch } = useQuiz();
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);

    const cd = state.currentQuizData;

    useEffect(() => {
        setMounted(true);
        if (!cd) {
            navigate('/');
        }
    }, [cd, navigate]);

    if (!cd) return null;

    const correctCount = cd.attempts.filter((a: any) => a.status === 'Correct').length;
    const wrongCount = cd.attempts.filter((a: any) => a.status === 'Wrong').length;
    const timedOutCount = cd.attempts.filter((a: any) => a.status === 'Timeout').length;
    const totalQuestions = cd.shuffledQuestions.length;
    const attemptedQuestions = correctCount + wrongCount + timedOutCount;
    const unattempted = totalQuestions - attemptedQuestions;

    const accuracy = attemptedQuestions > 0 ? ((correctCount / attemptedQuestions) * 100).toFixed(1) : "0.0";
    const completion = (attemptedQuestions / totalQuestions) * 100;

    const getScoreRemark = (acc: string) => {
        const val = parseFloat(acc);
        if (val >= 95) return { text: "Outstanding! 🏆 You're a true master of this topic!", class: 'remark-a1' };
        if (val >= 90) return { text: "Excellent Work! 🧠 You have a superb understanding.", class: 'remark-a2' };
        if (val >= 80) return { text: "Great Job! 👍 You're well on your way to mastery.", class: 'remark-b1' };
        if (val >= 60) return { text: "Good Effort! 📚 Keep practicing to solidify your knowledge.", class: 'remark-b2' };
        if (val >= 40) return { text: "Keep Going! 💪 Every review is a step toward success.", class: 'remark-c' };
        return { text: "Don't Give Up! 🌱 The first step to learning is trying.", class: 'remark-d' };
    };

    const remark = getScoreRemark(accuracy);

    // Donut Chart Helpers
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const correctPercent = attemptedQuestions > 0 ? (correctCount / attemptedQuestions) * 100 : 0; // Visualizing relative to attempts? No, usually total.
    // Let's stick to total for the chart logic from legacy code
    const totalForChart = correctCount + wrongCount + timedOutCount + unattempted; // Should be totalQuestions
    const pCorrect = (correctCount / totalQuestions) * 100;
    const pWrong = ((wrongCount + timedOutCount) / totalQuestions) * 100;
    const pSkipped = (unattempted / totalQuestions) * 100;

    const handleShare = async () => {
         const scoreContainer = document.querySelector('.final-score-container') as HTMLElement;
         if (scoreContainer && navigator.share) {
             try {
                 const canvas = await html2canvas(scoreContainer, { useCORS: true, backgroundColor: '#ffffff' });
                 const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                 if(blob) {
                     const file = new File([blob], 'result.png', { type: 'image/png' });
                     await navigator.share({
                         title: 'My Quiz Result',
                         text: `I scored ${correctCount}/${totalQuestions} on QuizLM!`,
                         files: [file]
                     });
                 }
             } catch(e) { console.error(e); }
         } else {
             alert("Sharing not supported or failed.");
         }
    };

    const handleRestart = () => {
        Swal.fire({
            title: 'Start a new quiz?',
            text: "You'll be taken back to the filter screen.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes'
        }).then((result: any) => {
            if (result.isConfirmed) {
                dispatch({ type: 'SET_STATE', payload: { isQuizActive: false, questionGroups: [] } });
                navigate('/');
            }
        });
    };

    return (
        <div id="final-score-section" className={`section-fade-in ${mounted ? 'visible' : ''}`} style={{display: 'block'}}>
             <div className="final-score-container">
                 <h1 id="score-title">Quiz Result - {cd.groupName}</h1>
                 <div id="score-remark"><p className={remark.class}>{remark.text}</p></div>

                 <div id="score-visuals-container">
                    <div id="score-donut-chart-container">
                        <svg viewBox="0 0 60 60" className="score-donut-chart">
                            {/* Skipped */}
                            <circle className="donut-segment donut-segment-skipped" cx="30" cy="30" r={radius}
                                strokeDasharray={`${(pSkipped/100)*circumference} ${circumference}`}
                                transform={`rotate(${(pCorrect + pWrong) * 3.6} 30 30)`} />
                            {/* Wrong */}
                            <circle className="donut-segment donut-segment-wrong" cx="30" cy="30" r={radius}
                                strokeDasharray={`${(pWrong/100)*circumference} ${circumference}`}
                                transform={`rotate(${pCorrect * 3.6} 30 30)`} />
                            {/* Correct */}
                            <circle className="donut-segment donut-segment-correct" cx="30" cy="30" r={radius}
                                strokeDasharray={`${(pCorrect/100)*circumference} ${circumference}`}
                                transform={`rotate(0 30 30)`} />
                        </svg>
                        <div className="donut-chart-center-text">{Math.round(parseFloat(accuracy))}%</div>
                    </div>

                    <div id="score-stats-container">
                        <div className="stat-item">
                            <span className="stat-label">Accuracy Rate</span>
                            <div className="progress-bar-container">
                                <div id="accuracy-progress-bar" className="progress-bar-fill" style={{width: `${accuracy}%`}}></div>
                            </div>
                            <span className="stat-value">{accuracy}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Completion Rate</span>
                            <div className="progress-bar-container">
                                <div id="completion-progress-bar" className="progress-bar-fill" style={{width: `${completion}%`}}></div>
                            </div>
                            <span className="stat-value">{Math.round(completion)}%</span>
                        </div>
                    </div>
                </div>

                 <div id="score-summary-list">
                    <div className="summary-item"><span>Current Group:</span> <span>{cd.groupName}</span></div>
                    <div className="summary-item"><span>Total Qs:</span> <span>{totalQuestions}</span></div>
                    <div className="summary-item"><span>Attempted:</span> <span>{attemptedQuestions}</span></div>
                    <div className="summary-item"><span>Correct ✅:</span> <span>{correctCount}</span></div>
                    <div className="summary-item"><span>Wrong ❌:</span> <span>{wrongCount}</span></div>
                    <div className="summary-item"><span>Timeout ⏱️:</span> <span>{timedOutCount}</span></div>
                    <div className="summary-item"><span>Unattempted:</span> <span>{unattempted}</span></div>
                 </div>

                 <div className="button-group">
                     <button id="review-btn" onClick={() => navigate('/review')} disabled={attemptedQuestions === 0}>Review Answers</button>
                     <button id="share-results-btn" onClick={handleShare}>Share Results <i className="fas fa-share-alt"></i></button>
                     <button id="restart-full-quiz-btn" onClick={handleRestart}>Restart Quiz</button>
                 </div>
             </div>
        </div>
    );
};
