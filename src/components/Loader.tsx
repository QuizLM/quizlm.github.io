import React from 'react';

export const Loader: React.FC<{ message?: string }> = ({ message }) => {
    return (
        <div id="loading-overlay" style={{ display: 'flex' }}>
            <div className="loader-content">
                <lottie-player src="https://assets5.lottiefiles.com/packages/lf20_HX0isy.json" background="transparent" speed="1" style={{ width: '200px', height: '200px' }} loop autoplay></lottie-player>
                <p id="loading-text">{message || "Loading..."}</p>
            </div>
        </div>
    );
};
