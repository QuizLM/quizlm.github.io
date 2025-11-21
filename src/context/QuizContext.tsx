import React, { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../lib/config';
import { Toast } from '../lib/utils';

interface QuizContextType {
    state: any;
    dispatch: React.Dispatch<any>;
    saveSettings: () => void;
    saveQuizState: () => void;
    clearQuizState: () => void;
}

// Initial State based on state.js
const initialState = {
    allQuestionsMasterList: [],
    filteredQuestionsMasterList: [],
    questionGroups: [],
    currentGroupIndex: 0,
    currentQuizData: null,
    timeLeftForQuestion: config.timePerQuestion,
    currentLifelineUsed: false,
    isMuted: false,
    isShuffleActive: false,
    isDarkMode: false,
    animationsDisabled: false,
    isHapticEnabled: true,
    bookmarkedQuestions: [],
    isHeaderCollapsed: false,
    currentZoomMultiplier: 1.0,
    selectedFilters: {
        subject: [], topic: [], subTopic: [],
        difficulty: [], questionType: [],
        examName: [], examYear: [],
        tags: []
    },
    isQuizActive: false,
};

const QuizContext = createContext<QuizContextType | undefined>(undefined);

export const QuizProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState(initialState);

    // Load settings on mount
    useEffect(() => {
        try {
            const savedSettingsJSON = localStorage.getItem('quizAppSettings');
            if (savedSettingsJSON) {
                const savedSettings = JSON.parse(savedSettingsJSON);
                setState(prev => ({
                    ...prev,
                    ...savedSettings
                }));
            }
        } catch (e) {
            console.error("Error loading settings", e);
        }

        // Load active quiz session
        try {
             const savedSessionJSON = localStorage.getItem('quizActiveSession');
             if (savedSessionJSON) {
                 const savedSession = JSON.parse(savedSessionJSON);
                 setState(prev => {
                     const newState = { ...prev, ...savedSession };
                     if (newState.questionGroups.length > 0) {
                         newState.currentQuizData = newState.questionGroups[newState.currentGroupIndex];
                     }
                     return newState;
                 });
             }
        } catch(e) {
            console.error("Error loading quiz session", e);
        }
    }, []);

    // Dispatch helper to update state
    const dispatch = (action: any) => {
        // Simple Redux-like reducer or just direct state updates
        if (action.type === 'SET_STATE') {
            setState(prev => ({ ...prev, ...action.payload }));
        } else if (action.type === 'UPDATE_SETTINGS') {
             setState(prev => {
                 const newState = { ...prev, ...action.payload };
                 // Side effect: Save settings
                 const settingsToSave = {
                    isShuffleActive: newState.isShuffleActive,
                    isMuted: newState.isMuted,
                    isDarkMode: newState.isDarkMode,
                    animationsDisabled: newState.animationsDisabled,
                    isHapticEnabled: newState.isHapticEnabled,
                    bookmarkedQuestions: newState.bookmarkedQuestions,
                    isHeaderCollapsed: newState.isHeaderCollapsed,
                };
                localStorage.setItem('quizAppSettings', JSON.stringify(settingsToSave));
                 return newState;
             });
        } else if (action.type === 'UPDATE_QUIZ_DATA') {
            setState(prev => {
                const newState = { ...prev, ...action.payload };
                return newState;
            });
        }
    };

    const saveSettings = () => {
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
    };

    const saveQuizState = () => {
        if (!state.isQuizActive) return;
        const sessionState = {
            isQuizActive: state.isQuizActive,
            questionGroups: state.questionGroups,
            currentGroupIndex: state.currentGroupIndex,
            selectedFilters: state.selectedFilters,
        };
        localStorage.setItem('quizActiveSession', JSON.stringify(sessionState));
    };

    const clearQuizState = () => {
        localStorage.removeItem('quizActiveSession');
        setState(prev => ({
            ...prev,
            isQuizActive: false,
            questionGroups: [],
            currentGroupIndex: 0,
            currentQuizData: null
        }));
    };

    // Auto-save quiz state when relevant parts change
    useEffect(() => {
        if (state.isQuizActive) {
            saveQuizState();
        }
    }, [state.questionGroups, state.currentGroupIndex, state.selectedFilters, state.isQuizActive]);


    return (
        <QuizContext.Provider value={{ state, dispatch, saveSettings, saveQuizState, clearQuizState }}>
            {children}
        </QuizContext.Provider>
    );
};

export const useQuiz = () => {
    const context = useContext(QuizContext);
    if (context === undefined) {
        throw new Error('useQuiz must be used within a QuizProvider');
    }
    return context;
};
