import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuiz } from '../context/QuizContext';
import { Link, useNavigate } from 'react-router-dom';
import { PaidServicesModal } from './PaidServicesModal';
import { UserGuideModal } from './UserGuideModal';
import { SettingsModal } from './SettingsModal';
import { AboutModal } from './AboutModal';
import { PrivacyModal } from './PrivacyModal';

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { user, profile, signOut } = useAuth();
    const { dispatch } = useQuiz();
    const navigate = useNavigate();

    const [activeModal, setActiveModal] = useState<string | null>(null);

    const handleLogout = async () => {
        await signOut();
        onClose();
        dispatch({ type: 'SET_STATE', payload: { isQuizActive: false, questionGroups: [] } });
        navigate('/login');
    };

    const openModal = (modalName: string) => {
        onClose(); // Close sidebar first
        setActiveModal(modalName);
    };

    if (!isOpen && !activeModal) return null;

    return (
        <>
        {isOpen && (
            <div id="side-menu-overlay" className="visible" onClick={(e) => { if(e.target === e.currentTarget) onClose() }}>
                <div className="side-menu-panel">
                    <div className="side-menu-header">
                        <button id="side-menu-close-btn" aria-label="Close Menu" onClick={onClose}>&times;</button>
                    </div>
                    <div className="side-menu-profile">
                        <img id="side-menu-profile-pic" src={profile?.avatar_url || "https://via.placeholder.com/60"} alt="Profile" />
                        <span id="side-menu-profile-name">{profile?.full_name || user?.email || "Guest"}</span>
                        <span id="side-menu-subscription-status" className={`subscription-badge ${profile?.subscription_status === 'pro' ? 'pro-plan' : profile?.subscription_status === 'spark' ? 'spark-plan' : ''}`}>
                            {profile?.subscription_status ? `${profile.subscription_status.charAt(0).toUpperCase() + profile.subscription_status.slice(1)} Plan` : 'Free Plan'}
                        </span>
                    </div>
                    <nav className="side-menu-nav">
                        <ul>
                            <li><Link to="/" onClick={onClose}><i className="fas fa-list-check"></i> QuizLM</Link></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('paid'); }}><i className="fas fa-dollar-sign"></i> Paid Services</a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('settings'); }}><i className="fas fa-user-cog"></i> Settings</a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('guide'); }}><i className="fas fa-book"></i> User Guide</a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('about'); }}><i className="fas fa-users"></i> About Us</a></li>
                            <li><a href="#" onClick={(e) => { e.preventDefault(); openModal('privacy'); }}><i className="fas fa-shield-alt"></i> Privacy Policy</a></li>
                            <li><a href="#" onClick={handleLogout}><i className="fas fa-sign-out-alt"></i> Logout</a></li>
                        </ul>
                    </nav>
                </div>
            </div>
        )}

        <PaidServicesModal isOpen={activeModal === 'paid'} onClose={() => setActiveModal(null)} />
        <SettingsModal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} />
        <UserGuideModal isOpen={activeModal === 'guide'} onClose={() => setActiveModal(null)} />
        <AboutModal isOpen={activeModal === 'about'} onClose={() => setActiveModal(null)} />
        <PrivacyModal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} />
        </>
    );
};
