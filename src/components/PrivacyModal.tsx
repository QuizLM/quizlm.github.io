import React from 'react';
import { Modal } from './Modal';

export const PrivacyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Privacy Policy">
            <div className="privacy-policy-body">
                <h3>1. Introduction</h3>
                <p>Welcome to Quiz LM. This Privacy Policy explains how we collect, use, and protect your personal data in compliance with India's Digital Personal Data Protection (DPDP) Act, 2023.</p>

                <h3>2. Data We Collect</h3>
                <p>We collect the following personal data:</p>
                <ul>
                    <li><strong>Information from Google:</strong> When you sign in, we receive your name, email address, and profile picture.</li>
                    <li><strong>Quiz Data:</strong> We track your quiz attempts, scores, and progress.</li>
                </ul>

                <h3>3. How We Use Your Data</h3>
                <p>Your data is used to authenticate you, save your progress, and improve our application.</p>

                <h3>4. Your Rights</h3>
                <p>You have the right to access, correct, or erase your personal data.</p>

                <h3>5. Data Security</h3>
                <p>We use secure services provided by Supabase to store and protect your data.</p>
            </div>
        </Modal>
    );
};
