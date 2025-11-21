import React, { useEffect, useRef, useState } from 'react';
import { useQuiz } from '../context/QuizContext';
import { config } from '../lib/config';
import { shuffleArray, playSound, triggerHapticFeedback, buildExplanationHtml, Toast } from '../lib/utils';
import { typewriterAnimate } from '../lib/animations';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Helper to parse new coded IDs like "HIS1", "POL72"
function parseCodedId(idString: string) {
    if (typeof idString !== 'string') {
        return { prefix: '', num: parseInt(idString, 10) || 0 };
    }
    const match = idString.match(/^([A-Z]+)(\d+)$/);
    if (match) {
        return { prefix: match[1], num: parseInt(match[2], 10) };
    }
    return { prefix: idString, num: 0 };
}

declare const Swal: any;

export const Quiz: React.FC = () => {
    const { state, dispatch, saveQuizState, saveSettings } = useQuiz();
    const { profile, updateProfile } = useAuth();
    const navigate = useNavigate();

    const [timeLeft, setTimeLeft] = useState(config.timePerQuestion);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const timerRef = useRef<any>(null);
    const explanationRef = useRef<HTMLDivElement>(null);

    // Ensure we have data
    const group = state.questionGroups[state.currentGroupIndex];
    const question = group?.shuffledQuestions[state.currentQuizData?.currentQuestionIndex || 0];

    // Initialize quiz data if needed (similar to loadQuiz logic)
    useEffect(() => {
        if (state.questionGroups.length === 0) {
            // Check if we have filtered questions to build from
            if (state.filteredQuestionsMasterList.length > 0) {
                 const groups = [];
                 const questions = [...state.filteredQuestionsMasterList];
                 for (let i = 0; i < questions.length; i += config.questionsPerGroup) {
                    const chunk = questions.slice(i, i + config.questionsPerGroup);
                    // Sort/Shuffle
                    const shuffled = [...chunk];
                     if (state.isShuffleActive) {
                        shuffleArray(shuffled);
                    } else {
                         shuffled.sort((a: any, b: any) => {
                             const idA = parseCodedId(a.v1_id);
                             const idB = parseCodedId(b.v1_id);
                             if (idA.prefix < idB.prefix) return -1;
                             if (idA.prefix > idB.prefix) return 1;
                             return idA.num - idB.num;
                         });
                    }
                    groups.push({
                        groupName: `Questions ${i + 1}-${Math.min(i + config.questionsPerGroup, questions.length)}`,
                        questions: chunk,
                        shuffledQuestions: shuffled,
                        attempts: [],
                        markedForReview: [],
                        currentQuestionIndex: 0
                    });
                 }
                 dispatch({
                     type: 'UPDATE_QUIZ_DATA',
                     payload: {
                         questionGroups: groups,
                         currentGroupIndex: 0,
                         isQuizActive: true,
                         currentQuizData: groups[0]
                     }
                 });
            } else {
                // No data, go back home
                navigate('/');
            }
        }
    }, [state.questionGroups.length, state.filteredQuestionsMasterList, state.isShuffleActive, dispatch, navigate]);


    // Timer Logic
    useEffect(() => {
        if (!question || selectedOption) return; // Stop timer if answered

        // Check if this question was already attempted
        const attempt = group.attempts.find((a: any) => a.questionId === question.id);
        if (attempt) {
            setSelectedOption(attempt.selected);
            setTimeLeft(0); // Or show time taken? For UI consistency, maybe 0.
            if (explanationRef.current) {
                explanationRef.current.style.display = 'block';
                explanationRef.current.innerHTML = buildExplanationHtml(question.explanation);
            }
            return;
        }

        // Reset UI for new question
        setSelectedOption(null);
        if (explanationRef.current) {
            explanationRef.current.style.display = 'none';
            explanationRef.current.innerHTML = '';
        }

        setTimeLeft(config.timePerQuestion);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [question?.id, group?.attempts]); // Reset when question changes


    const handleTimeout = () => {
         submitAnswer('Timed Out', false, true);
    };

    const checkAnswer = (selected: string) => {
        if (selectedOption) return; // Already answered
        const isCorrect = selected.trim() === question.correct.trim();
        submitAnswer(selected, isCorrect, false);
    };

    const submitAnswer = async (selected: string, isCorrect: boolean, isTimeout: boolean) => {
        setSelectedOption(selected);
        clearInterval(timerRef.current);

        // Feedback
        if (isCorrect) {
            playSound('correct-sound', state.isMuted);
            triggerHapticFeedback('correct', state.isHapticEnabled);
        } else {
            playSound('wrong-sound', state.isMuted);
            triggerHapticFeedback('wrong', state.isHapticEnabled);
        }

        // Update State
        const attempt = {
            questionId: question.id,
            v1_id: question.v1_id,
            question: question.question,
            question_hi: question.question_hi,
            options: question.options,
            options_hi: question.options_hi,
            correct: question.correct,
            selected: selected,
            status: isTimeout ? 'Timeout' : (isCorrect ? 'Correct' : 'Wrong'),
            timeTaken: config.timePerQuestion - timeLeft,
            explanation: question.explanation
        };

        // Update attempts in global state
        const updatedGroups = [...state.questionGroups];
        const currentGroup = updatedGroups[state.currentGroupIndex];
        const existingAttemptIndex = currentGroup.attempts.findIndex((a: any) => a.questionId === question.id);

        if (existingAttemptIndex > -1) {
            currentGroup.attempts[existingAttemptIndex] = attempt;
        } else {
            currentGroup.attempts.push(attempt);
        }

        dispatch({ type: 'UPDATE_QUIZ_DATA', payload: { questionGroups: updatedGroups } });

        // Show explanation
        if (explanationRef.current) {
            explanationRef.current.style.display = 'block';
            explanationRef.current.innerHTML = ''; // clear prev
            await typewriterAnimate(explanationRef.current, buildExplanationHtml(question.explanation));
        }

        // Handle limits (Spark/Free)
        if (profile && profile.subscription_status !== 'pro') {
             const isSpark = profile.subscription_status === 'spark';
             const limits = isSpark ? config.sparkPlanLimits : config.freePlanLimits;
             if (profile.daily_questions_attempted >= limits.questions) {
                  // Limit reached logic
                  Swal.fire({
                      title: 'Daily Limit Reached',
                      text: 'Upgrade to continue',
                      icon: 'warning',
                      confirmButtonText: 'End Quiz'
                  }).then(() => {
                      navigate('/result');
                  });
                  return;
             }
             // Increment count
             await updateProfile({ daily_questions_attempted: profile.daily_questions_attempted + 1 });
        }
    };

    const nextQuestion = () => {
        setIsTransitioning(true);
        setTimeout(() => {
            const currentGroup = state.questionGroups[state.currentGroupIndex];
            const currentIndex = currentGroup.currentQuestionIndex;

            if (currentIndex < currentGroup.shuffledQuestions.length - 1) {
                // Next in group
                 const updatedGroups = [...state.questionGroups];
                 updatedGroups[state.currentGroupIndex].currentQuestionIndex = currentIndex + 1;
                 dispatch({ type: 'UPDATE_QUIZ_DATA', payload: { questionGroups: updatedGroups, currentQuizData: updatedGroups[state.currentGroupIndex] } });
            } else if (state.currentGroupIndex < state.questionGroups.length - 1) {
                // Next group
                const newIndex = state.currentGroupIndex + 1;
                 dispatch({ type: 'UPDATE_QUIZ_DATA', payload: { currentGroupIndex: newIndex, currentQuizData: state.questionGroups[newIndex] } });
            } else {
                // End of quiz
                navigate('/result');
            }
            setIsTransitioning(false);
        }, 300);
    };

    const prevQuestion = () => {
        if (group.currentQuestionIndex === 0) return;
        setIsTransitioning(true);
        setTimeout(() => {
            const updatedGroups = [...state.questionGroups];
            updatedGroups[state.currentGroupIndex].currentQuestionIndex = group.currentQuestionIndex - 1;
            dispatch({ type: 'UPDATE_QUIZ_DATA', payload: { questionGroups: updatedGroups, currentQuizData: updatedGroups[state.currentGroupIndex] } });
            setIsTransitioning(false);
        }, 300);
    };

    const toggleMarkReview = () => {
        const updatedGroups = [...state.questionGroups];
        const currentGroup = updatedGroups[state.currentGroupIndex];
        const qId = question.id;
        const index = currentGroup.markedForReview.indexOf(qId);

        if (index > -1) {
            currentGroup.markedForReview.splice(index, 1);
        } else {
            currentGroup.markedForReview.push(qId);
        }
        dispatch({ type: 'UPDATE_QUIZ_DATA', payload: { questionGroups: updatedGroups } });
        saveQuizState();
    };

    const toggleBookmark = () => {
        const qId = question.id;
        const newBookmarks = [...state.bookmarkedQuestions];
        const index = newBookmarks.indexOf(qId);

        if (index > -1) {
            newBookmarks.splice(index, 1);
            Toast.fire({icon: 'info', title: 'Bookmark removed'});
        } else {
            newBookmarks.push(qId);
            Toast.fire({icon: 'success', title: 'Question bookmarked!'});
        }

        dispatch({ type: 'UPDATE_SETTINGS', payload: { bookmarkedQuestions: newBookmarks } });
        // saveSettings() is handled by side-effect in dispatch, but good to be explicit if needed
    };

    if (!question) return <div className="container">Loading Question...</div>;

    const isMarked = group.markedForReview.includes(question.id);
    const isBookmarked = state.bookmarkedQuestions.includes(question.id);

    return (
         <div id="quiz-section" style={{display: 'block'}}>
             {/* Use existing HTML structure adapted to React */}
            <div className="quiz-header-bar">
                <h1 id="quiz-title">{group.groupName}</h1>
                <button id="toggle-header-btn" title="Toggle Details Panel" onClick={() => dispatch({type: 'UPDATE_SETTINGS', payload: { isHeaderCollapsed: !state.isHeaderCollapsed}})}>
                    <i className={`fas fa-chevron-${state.isHeaderCollapsed ? 'down' : 'up'}`}></i>
                </button>
            </div>

            <div id="collapsible-header-content" className={state.isHeaderCollapsed ? 'collapsed' : ''}>
                <div id="quiz-progress-bar-container">
                    <div id="quiz-progress-bar" style={{width: `${((group.currentQuestionIndex) / group.shuffledQuestions.length) * 100}%`}}></div>
                </div>
                <div className="timer-lifeline-area">
                     <div className="controls-left">
                         <div id="timer" className={timeLeft <= 10 ? 'timeout' : ''}>Time Left: <span>{timeLeft}</span>s</div>
                     </div>
                </div>
                <div id="timer-bar-container">
                    <div id="timer-bar" className={selectedOption ? 'paused' : ''} style={{width: `${(timeLeft / config.timePerQuestion) * 100}%`}}></div>
                </div>
            </div>

             <div id="quiz-container" className={`quiz-container ${isTransitioning ? 'is-transitioning-out' : ''}`}>
                 <div className="question-numbering-area">
                    <div className="q-area-left-group">
                        <span>Q {group.currentQuestionIndex + 1}/{group.shuffledQuestions.length}</span>
                        <button id="bookmark-btn" className={isBookmarked ? 'bookmarked' : ''} onClick={toggleBookmark}>
                            <i className={isBookmarked ? "fas fa-star" : "far fa-star"}></i>
                        </button>
                    </div>
                    <div className="q-area-center-group">
                        <span className="context-tag">{question.examName}</span>
                        <span className="context-tag">{question.examYear}</span>
                    </div>
                    <span>ID: {question.v1_id || question.id}</span>
                 </div>
                 <h2 id="question-text">
                     {question.question.replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '')}
                     {question.question_hi && (
                         <>
                             <hr className="lang-separator" />
                             <span className="hindi-text">{question.question_hi.replace(/^(Q\.\d+\)|प्रश्न \d+\))\s*/, '')}</span>
                         </>
                     )}
                 </h2>
                 <div id="options" className="options">
                     {question.options.map((opt: string, idx: number) => {
                         const optHi = question.options_hi ? question.options_hi[idx] : '';
                         let btnClass = '';
                         if (selectedOption) {
                             if (opt === question.correct) btnClass = 'correct reveal-correct'; // Always show correct
                             else if (opt === selectedOption) btnClass = 'wrong';
                             else btnClass = '';
                         }

                         return (
                             <button
                                key={idx}
                                className={btnClass}
                                onClick={() => checkAnswer(opt)}
                                disabled={!!selectedOption}
                             >
                                 {opt}
                                 {optHi && <><br/><span className="hindi-text">{optHi}</span></>}
                             </button>
                         )
                     })}
                 </div>
                 <div id="explanation" ref={explanationRef} style={{display: 'none'}}></div>
             </div>

             <div className="button-group">
                {selectedOption && <button id="next-btn" style={{display: 'block'}} onClick={nextQuestion}>Next Question</button>}
            </div>

            <div id="quiz-nav-bar">
                <button className="quiz-nav-btn" onClick={prevQuestion} disabled={group.currentQuestionIndex === 0}>
                    <i className="fas fa-arrow-left"></i> Previous
                </button>
                <button className={`quiz-nav-btn ${isMarked ? 'marked' : ''}`} onClick={toggleMarkReview}>
                        {isMarked ? <><i className="fas fa-flag"></i> Marked</> : <><i className="far fa-flag"></i> Mark for Review</>}
                </button>
                <button className="quiz-nav-btn" onClick={nextQuestion}>
                    Next <i className="fas fa-arrow-right"></i>
                </button>
            </div>

            {/* Hidden Audio Elements for Logic */}
            <audio id="correct-sound" src="https://www.fesliyanstudios.com/play-mp3/5744" preload="auto"></audio>
            <audio id="wrong-sound" src="https://www.fesliyanstudios.com/play-mp3/7002" preload="auto"></audio>
        </div>
    );
};
