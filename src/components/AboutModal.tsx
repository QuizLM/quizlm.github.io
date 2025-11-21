import React from 'react';
import { Modal } from './Modal';

export const AboutModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="About Us" iconClass="fas fa-users">
            <div className="content-modal-body about-us-body" style={{textAlign: 'center'}}>
                <i className="fas fa-brain about-icon" style={{fontSize: '4rem', color: 'var(--primary-color)', marginBottom: '1rem'}}></i>
                <h3>Quiz LM</h3>
                <p>Created with passion by</p>
                <p className="creator-name" style={{fontWeight: 'bold', fontSize: '1.2rem'}}>Aalok Kumar Sharma</p>
                <div className="divider"></div>
                <p className="mission-statement">
                    Our mission is to provide a powerful, flexible, and modern platform for students and enthusiasts to master their subjects through targeted practice and offline study materials.
                </p>
            </div>
        </Modal>
    );
};
