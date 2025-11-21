import React, { useState } from 'react';
import { Sidebar } from './Sidebar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            {/*
                The Layout doesn't wrap everything in a container div because the legacy CSS
                expects sections to be direct children of body or containers.
                We will inject the hamburger button logic into pages or a Header component.
            */}
             <header className="homepage-header" style={{display: 'flex', justifyContent: 'space-between', padding: '1rem'}}>
                <div className="logo">
                    <i className="fas fa-brain"></i> Quiz LM 2.33
                </div>
                <button id="hamburger-menu-btn" aria-label="Open Menu" onClick={() => setIsSidebarOpen(true)}>
                    <div className="hamburger-icon">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </button>
            </header>
            <main>
                {children}
            </main>
        </>
    );
};
