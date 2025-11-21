import React from 'react';
import { Modal } from './Modal';
import { useQuiz } from '../context/QuizContext';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { state, dispatch } = useQuiz();

    const updateSetting = (key: string, value: boolean) => {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quiz Settings">
            <div className="settings-body">
                <div className="setting-row">
                    <label htmlFor="dark-mode-toggle"><i className="fas fa-moon"></i> Dark Mode</label>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            id="dark-mode-toggle"
                            checked={state.isDarkMode}
                            onChange={(e) => updateSetting('isDarkMode', e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <label htmlFor="sound-toggle"><i className="fas fa-volume-up"></i> Sound</label>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            id="sound-toggle"
                            checked={!state.isMuted}
                            onChange={(e) => updateSetting('isMuted', !e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <label htmlFor="shuffle-toggle"><i className="fas fa-random"></i> Shuffle Questions</label>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            id="shuffle-toggle"
                            checked={state.isShuffleActive}
                            onChange={(e) => updateSetting('isShuffleActive', e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <label htmlFor="animations-toggle"><i className="fas fa-magic"></i> Background Animations</label>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            id="animations-toggle"
                            checked={!state.animationsDisabled}
                            onChange={(e) => updateSetting('animationsDisabled', !e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <label htmlFor="haptic-toggle"><i className="fas fa-vibrator"></i> Haptic Feedback</label>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            id="haptic-toggle"
                            checked={state.isHapticEnabled}
                            onChange={(e) => updateSetting('isHapticEnabled', e.target.checked)}
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>
        </Modal>
    );
};
