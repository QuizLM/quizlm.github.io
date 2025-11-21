// src/pages/Home.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useFilter } from '../hooks/useFilter';
import { useQuiz } from '../context/QuizContext';
import { config } from '../lib/config';
import { Loader } from '../components/Loader';
import { PaidServicesModal } from '../components/PaidServicesModal';
import { UserGuideModal } from '../components/UserGuideModal';

declare const Swal: any;

// --- Helper Components for Filters ---

const MultiSelectDropdown: React.FC<{
    filterKey: string;
    options: string[];
    selected: string[];
    counts: Map<string, number>;
    onToggle: (val: string) => void;
    label: string;
    disabled?: boolean;
}> = ({ filterKey, options, selected, counts, onToggle, label, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const keyName = filterKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const btnText = selected.length === 0 ? `Select ${keyName}` : selected.length === 1 ? selected[0] : `${selected.length} ${keyName} selected`;

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className={`filter-control ${disabled ? 'disabled' : ''}`}>
            <label>{label}</label>
            <div className={`custom-multiselect ${isOpen ? 'open' : ''}`}>
                <button
                    className="filter-toggle-btn"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                >
                    {disabled ? label : btnText}
                </button>
                {isOpen && (
                    <>
                        <div className="backdrop" onClick={() => setIsOpen(false)} style={{position:'fixed', top:0, left:0, right:0, bottom:0, zIndex: 99}}/>
                        <div className="multiselect-dropdown-panel" style={{display: 'flex', zIndex: 100}}>
                            <input
                                type="text"
                                className="multiselect-search-input"
                                placeholder={`Search ${keyName.toLowerCase()}...`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                autoFocus
                            />
                            <div className="multiselect-list-container">
                                {filteredOptions.map(opt => {
                                    const count = counts.get(opt) || 0;
                                    const isChecked = selected.includes(opt);
                                    const isDisabled = count === 0 && !isChecked;
                                    return (
                                        <label key={opt} className={`multiselect-item ${isDisabled ? 'disabled' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => onToggle(opt)}
                                                disabled={isDisabled}
                                            />
                                            <span>{opt}</span>
                                            <span className="filter-option-count">({count})</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useQuiz();
    const {
        loading, loadQuestions, counts, filteredCount, toggleFilter, resetFilters, handleQueryAttempt
    } = useFilter();

    const [view, setView] = useState<'hero' | 'filter'>('hero');
    const [activeTab, setActiveTab] = useState<'quiz' | 'ppt' | 'json'>('quiz');
    const [isPaidModalOpen, setIsPaidModalOpen] = useState(false);
    const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
    const [docLoading, setDocLoading] = useState<{active: boolean, message: string, progress: number} | null>(null);

    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        loadQuestions();

        // Init Worker
        if (window.Worker) {
            workerRef.current = new Worker('/worker.js');
            workerRef.current.onmessage = (e) => {
                const { type, blob, filename, error, value, details } = e.data;

                if (type === 'progress') {
                    setDocLoading({ active: true, message: details, progress: value });
                } else if (type === 'result') {
                    setDocLoading(null);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    Swal.fire('Success', `${filename} downloaded successfully!`, 'success');
                } else if (type === 'error') {
                    setDocLoading(null);
                    console.error('Worker error:', error);
                    Swal.fire('Error', 'Generation failed.', 'error');
                }
            };
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, [loadQuestions]);

    const handleStartQuiz = async () => {
        if (filteredCount === 0) return;
        const allowed = await handleQueryAttempt();
        if (allowed) {
            navigate('/quiz');
        } else {
             setIsPaidModalOpen(true);
        }
    };

    const handleDocGeneration = async (format: 'ppt' | 'pdf' | 'json') => {
        if (filteredCount === 0) return;
        const allowed = await handleQueryAttempt();
        if (!allowed) {
            setIsPaidModalOpen(true);
            return;
        }

        if (format === 'json') {
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
             return;
        }

        if (workerRef.current) {
            setDocLoading({ active: true, message: `Preparing ${format.toUpperCase()}...`, progress: 0 });
            workerRef.current.postMessage({
                type: 'generate',
                format: format,
                questions: state.filteredQuestionsMasterList,
                selectedFilters: state.selectedFilters
            });
        }
    };

    if (loading) return <Loader message="Loading Question Bank..." />;

    // Extract unique options for dropdowns
    const getOptions = (key: string) => {
        const unique = new Set<string>();
        state.allQuestionsMasterList.forEach((q: any) => {
            const val = q[key];
             if (key === 'tags' && Array.isArray(val)) {
                val.forEach((t: string) => unique.add(t));
            } else if (val) {
                unique.add(String(val));
            }
        });
        if (key === 'topic' && state.selectedFilters.subject.length > 0) {
             const relevant = new Set<string>();
             state.allQuestionsMasterList.forEach((q: any) => {
                 if (state.selectedFilters.subject.includes(q.subject) && q.topic) relevant.add(q.topic);
             });
             return Array.from(relevant).sort();
        }
        if (key === 'subTopic' && state.selectedFilters.topic.length > 0) {
             const relevant = new Set<string>();
             state.allQuestionsMasterList.forEach((q: any) => {
                 if (state.selectedFilters.subject.includes(q.subject) &&
                     state.selectedFilters.topic.includes(q.topic) && q.subTopic) relevant.add(q.subTopic);
             });
             return Array.from(relevant).sort();
        }
        return Array.from(unique).sort();
    };

    return (
        <Layout>
            {view === 'hero' ? (
                <>
                <div className="hero-section">
                    <h1>Master Your Subjects, <br/><span className="highlight">One Quiz at a Time.</span></h1>
                    <p>Build custom quizzes from a vast question bank, generate study materials, and track your progress like never before.</p>
                    <button id="hero-start-quiz-btn" className="cta-button" onClick={() => setView('filter')}>
                        Start a New Quiz <i className="fas fa-arrow-right"></i>
                    </button>
                </div>

                <div className="page-content">
                    <div className="feature-card" id="home-custom-quiz-card" onClick={() => setView('filter')}>
                        <div className="card-icon"><i className="fas fa-list-check"></i></div>
                        <h3>Build a Custom Quiz</h3>
                        <p>Use powerful filters to create targeted quizzes based on subject, topic, difficulty, and more.</p>
                    </div>
                    <div className="feature-card" id="home-content-creation-card" onClick={() => setIsPaidModalOpen(true)}>
                        <div className="paid-tag">Paid Services</div>
                        <div className="card-icon"><i className="fas fa-file-export"></i></div>
                        <h3>Content Creation Tools</h3>
                        <p>Generate downloadable PPT, PDF, or JSON files from your selected questions for offline study.</p>
                    </div>
                    <div className="feature-card" id="home-user-guide-card" onClick={() => setIsUserGuideOpen(true)}>
                        <div className="card-icon"><i className="fas fa-book-open-reader"></i></div>
                        <h3>User Guide</h3>
                        <p>Explore all the features of Quiz LM and learn how to make the most of your study sessions.</p>
                    </div>
                </div>
                <footer className="homepage-footer">
                    <p>&copy; 2024 Quiz LM by Aalok Kumar Sharma. All Rights Reserved.</p>
                </footer>
                </>
            ) : (
             <section id="filter-section" className="container" style={{display: 'block'}}>
                <div className="app-version">v12.1 (React)</div>
                <div className="home-link-container">
                    <a href="#" id="back-to-home-link" onClick={(e) => { e.preventDefault(); setView('hero'); }}>
                        <i className="fas fa-arrow-left"></i> Back to Home
                    </a>
                </div>
                <h1>Customize Your Session</h1>
                <p className="filter-subtitle">Select your criteria to build a targeted practice quiz.</p>

                 <div className="tab-nav">
                    <button className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`} onClick={() => setActiveTab('quiz')}><i className="fas fa-list-check"></i> Build a Quiz</button>
                    <button className={`tab-btn ${activeTab === 'ppt' ? 'active' : ''}`} onClick={() => setActiveTab('ppt')}><i className="fas fa-file-powerpoint"></i> Create PPT/PDF</button>
                    <button className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`} onClick={() => setActiveTab('json')}><i className="fas fa-file-code"></i> Download JSON</button>
                </div>

                <div id="tab-taglines">
                    {activeTab === 'quiz' && <p className="tagline active">Select Filters Prepare desired QUIZ SET. Answer questions and master your subjects.</p>}
                    {activeTab === 'ppt' && <p className="tagline active">Generate bilingual (EN+HI) PPT or English-only PDFs from your selected questions.</p>}
                    {activeTab === 'json' && <p className="tagline active">Create Bilingual PDF by Downloading JSON file.</p>}
                </div>

                <div className="filter-grid">
                    <div className="filter-group">
                        <h3><i className="fas fa-sitemap"></i> By Classification</h3>
                        <MultiSelectDropdown
                            filterKey="subject" label="Subject"
                            options={getOptions('subject')}
                            selected={state.selectedFilters.subject}
                            counts={counts.get('subject') || new Map()}
                            onToggle={v => toggleFilter('subject', v)}
                        />
                        <MultiSelectDropdown
                            filterKey="topic" label="Topic"
                            options={getOptions('topic')}
                            selected={state.selectedFilters.topic}
                            counts={counts.get('topic') || new Map()}
                            onToggle={v => toggleFilter('topic', v)}
                            disabled={state.selectedFilters.subject.length === 0}
                        />
                        <MultiSelectDropdown
                            filterKey="subTopic" label="Sub-Topic"
                            options={getOptions('subTopic')}
                            selected={state.selectedFilters.subTopic}
                            counts={counts.get('subTopic') || new Map()}
                            onToggle={v => toggleFilter('subTopic', v)}
                            disabled={state.selectedFilters.topic.length === 0}
                        />
                    </div>

                    <div className="filter-group">
                        <h3><i className="fas fa-layer-group"></i> By Properties</h3>
                         <div className="filter-control">
                            <label>Difficulty</label>
                            <div className="segmented-control">
                                {['Easy', 'Medium', 'Hard'].map(diff => (
                                    <button
                                        key={diff}
                                        className={`segmented-btn ${state.selectedFilters.difficulty.includes(diff) ? 'active' : ''}`}
                                        onClick={() => toggleFilter('difficulty', diff)}
                                    >
                                        <span>{diff}</span>
                                        <span className="filter-option-count">({(counts.get('difficulty') || new Map()).get(diff) || 0})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="filter-control">
                            <label>Question Type</label>
                            <div className="segmented-control">
                                {['MCQ'].map(type => (
                                    <button
                                        key={type}
                                        className={`segmented-btn ${state.selectedFilters.questionType.includes(type) ? 'active' : ''}`}
                                        onClick={() => toggleFilter('questionType', type)}
                                    >
                                        <span>{type}</span>
                                        <span className="filter-option-count">({(counts.get('questionType') || new Map()).get(type) || 0})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="filter-actions">
                    <button onClick={resetFilters}><i className="fas fa-undo"></i> Reset Filters</button>

                    {activeTab === 'quiz' && (
                        <button id="start-quiz-btn" disabled={filteredCount === 0} onClick={handleStartQuiz}>
                            Start Quiz ({filteredCount} Questions)
                        </button>
                    )}
                    {activeTab === 'ppt' && (
                        <>
                        <button id="create-pdf-btn" disabled={filteredCount === 0} onClick={() => handleDocGeneration('pdf')}>
                            <i className="fas fa-file-pdf"></i> Create PDF ({filteredCount} Qs)
                        </button>
                        <button id="create-ppt-btn" disabled={filteredCount === 0} onClick={() => handleDocGeneration('ppt')}>
                             <i className="fas fa-file-powerpoint"></i> Create PPT ({filteredCount} Qs)
                        </button>
                        </>
                    )}
                    {activeTab === 'json' && (
                        <button id="download-json-btn" disabled={filteredCount === 0} onClick={() => handleDocGeneration('json')}>
                             <i className="fas fa-download"></i> Download JSON ({filteredCount} Qs)
                        </button>
                    )}
                </div>

             </section>
            )}

             <PaidServicesModal isOpen={isPaidModalOpen} onClose={() => setIsPaidModalOpen(false)} />
             <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />

             {docLoading && (
                 <div id="pdf-loading-overlay" style={{display: 'flex'}}>
                    <div className="loader-content">
                        <lottie-player src="https://assets9.lottiefiles.com/packages/lf20_p8bfn5to.json" background="transparent" speed="1" style={{width: '200px', height: '200px'}} loop autoplay></lottie-player>
                        <p id="pdf-loading-text">{docLoading.message}</p>
                        <div className="loading-progress-container">
                            <div id="pdf-loading-progress-bar" style={{width: `${docLoading.progress}%`}}></div>
                        </div>
                    </div>
                </div>
             )}
        </Layout>
    );
};
