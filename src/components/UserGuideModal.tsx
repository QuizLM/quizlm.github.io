import React from 'react';
import { Modal } from './Modal';

export const UserGuideModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="User Guide" iconClass="fas fa-book">
            <div className="guide-section">
                <h4><i className="fas fa-list-check"></i> Build a Custom Quiz</h4>
                <p>Navigate to the "Build a Custom Quiz" section. Use the extensive filters for subject, topic, difficulty, and more to create a quiz tailored to your needs.</p>
            </div>
            <div className="guide-section">
                <h4><i className="fas fa-file-export"></i> Create Study Materials</h4>
                <p>Use the same filters to select questions and then choose to generate a bilingual PowerPoint (PPT), an English-only PDF, or a JSON file for your own projects. It's perfect for offline study and presentations.</p>
            </div>
             <div className="guide-section">
                <h4><i className="fas fa-chart-line"></i> Review & Analyze</h4>
                <p>After completing a quiz, you get a detailed score report. Use the "Review Answers" feature to go through each question, check the correct answers, and read detailed explanations to understand the concepts better.</p>
            </div>
            <div className="guide-section">
                <h4><i className="fas fa-cog"></i> Personalize Your Experience</h4>
                <p>Open the settings menu to toggle dark mode, sound effects, question shuffling, and background animations to make the app experience truly your own.</p>
            </div>
        </Modal>
    );
};
