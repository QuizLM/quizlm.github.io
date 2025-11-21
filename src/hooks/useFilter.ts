// This will be a custom hook or a context-based solution to handle filtering.
// We need to replicate the logic from filter.js using React state.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useQuiz } from '../context/QuizContext';
import { config } from '../lib/config';
import { debounce } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export function useFilter() {
    const { state, dispatch, saveSettings } = useQuiz();
    const { profile, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hierarchy, setHierarchy] = useState<any>({});

    // Local state for filtered counts to update UI without re-rendering everything aggressively
    const [counts, setCounts] = useState<Map<string, Map<string, number>>>(new Map());
    const [filteredCount, setFilteredCount] = useState(0);

    // Helper to fetch questions if empty
    const loadQuestions = useCallback(async () => {
        if (state.allQuestionsMasterList.length > 0) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('questions')
                .select('subject, topic, subTopic, difficulty, questionType, examName, examYear, tags, id, v1_id, question, question_hi, options, options_hi, correct, explanation')
                .order('v1_id', { ascending: true });

            if (error) throw error;

            dispatch({ type: 'SET_STATE', payload: { allQuestionsMasterList: data } });

        } catch (err: any) {
            console.error('Error loading questions:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [state.allQuestionsMasterList.length, dispatch]);

    // Build hierarchy map
    useEffect(() => {
        if (state.allQuestionsMasterList.length === 0) return;
        const h: any = {};
        state.allQuestionsMasterList.forEach((q: any) => {
            const { subject, topic, subTopic } = q;
            if (!subject || !topic) return;
            if (!h[subject]) h[subject] = {};
            if (!h[subject][topic]) h[subject][topic] = new Set();
            if (subTopic) h[subject][topic].add(subTopic);
        });
        setHierarchy(h);
    }, [state.allQuestionsMasterList]);


    // Core Filtering Logic
    const applyFilters = useCallback(() => {
        const questions = state.allQuestionsMasterList;
        const filters = state.selectedFilters;

        if (questions.length === 0) return;

        // 1. Calculate counts for each filter key assuming other filters are active
        // (This matches the behavior of `applyFiltersAndUpdateUI` in legacy code)
        const newCounts = new Map<string, Map<string, number>>();

        config.filterKeys.forEach(key => {
            const tempFilters = { ...filters, [key]: [] }; // Exclude current key from filter
            const relevantQuestions = questions.filter((q: any) => {
                 for (const k in tempFilters) {
                    const selected = (tempFilters as any)[k];
                    if (selected.length === 0) continue;
                    const qVal = q[k];
                    if (k === 'tags' && Array.isArray(qVal)) {
                        if (!selected.some((tag: string) => qVal.includes(tag))) return false;
                    } else {
                        if (!selected.includes(String(qVal))) return false;
                    }
                }
                return true;
            });

            const keyCounts = new Map<string, number>();
            relevantQuestions.forEach((q: any) => {
                let value = q[key];
                if (key === 'tags' && Array.isArray(value)) {
                    value.forEach(tag => keyCounts.set(tag, (keyCounts.get(tag) || 0) + 1));
                } else if (value) {
                    keyCounts.set(String(value), (keyCounts.get(String(value)) || 0) + 1);
                }
            });
            newCounts.set(key, keyCounts);
        });
        setCounts(newCounts);

        // 2. Get final filtered list
        const finalFilteredList = questions.filter((q: any) => {
            for (const k in filters) {
                const selected = (filters as any)[k];
                if (selected.length === 0) continue;
                const qVal = q[k];
                if (k === 'tags' && Array.isArray(qVal)) {
                    if (!selected.some((tag: string) => qVal.includes(tag))) return false;
                } else {
                    if (!selected.includes(String(qVal))) return false;
                }
            }
            return true;
        });

        dispatch({ type: 'SET_STATE', payload: { filteredQuestionsMasterList: finalFilteredList } });
        setFilteredCount(finalFilteredList.length);

    }, [state.allQuestionsMasterList, state.selectedFilters, dispatch]);

    // Debounced apply
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedApplyFilters = useCallback(debounce(applyFilters, 200), [applyFilters]);

    useEffect(() => {
        debouncedApplyFilters();
    }, [state.selectedFilters, debouncedApplyFilters]);


    const toggleFilter = (key: string, value: string) => {
        const current = state.selectedFilters[key] || [];
        const index = current.indexOf(value);
        let newValues;
        if (index > -1) {
            newValues = current.filter((v: string) => v !== value);
        } else {
            newValues = [...current, value];
        }

        const newFilters = { ...state.selectedFilters, [key]: newValues };

        // Hierarchy dependencies
        if (key === 'subject') {
            newFilters.topic = [];
            newFilters.subTopic = [];
        } else if (key === 'topic') {
            newFilters.subTopic = [];
        }

        dispatch({ type: 'SET_STATE', payload: { selectedFilters: newFilters } });
    };

    const resetFilters = () => {
        const reset: any = {};
        config.filterKeys.forEach(k => reset[k] = []);
        dispatch({ type: 'SET_STATE', payload: { selectedFilters: reset } });
    };

    const handleQueryAttempt = async () => {
        if (!profile || profile.subscription_status === 'pro') return true;
        const isSpark = profile.subscription_status === 'spark';
        const limits = isSpark ? config.sparkPlanLimits : config.freePlanLimits;

        if (profile.daily_queries_used >= limits.queries) {
            // Return false to indicate limit reached
            return false;
        }

        const newCount = profile.daily_queries_used + 1;
        await updateProfile({ daily_queries_used: newCount });
        return true;
    };

    return {
        loading,
        error,
        loadQuestions,
        counts,
        filteredCount,
        toggleFilter,
        resetFilters,
        handleQueryAttempt,
        hierarchy
    };
}
