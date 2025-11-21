import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    iconClass?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, iconClass }) => {
    if (!isOpen) return null;

    return (
        <div className="content-modal-overlay visible" style={{ display: 'flex' }} onClick={(e) => { if(e.target === e.currentTarget) onClose() }}>
            <div className="content-modal-panel">
                <div className="content-modal-header">
                    <h2>{iconClass && <i className={iconClass}></i>} {title}</h2>
                    <button className="content-modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="content-modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};
