import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader } from '../components/Loader';

export const Login: React.FC = () => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [consentAge, setConsentAge] = useState(false);
    const [consentPrivacy, setConsentPrivacy] = useState(false);

    if (loading) return <Loader message="Checking session..." />;

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        await signInWithEmail(email, password);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) return;
        await signUpWithEmail(name, email, password);
    };

    return (
        <section id="login-gate" className="container" style={{ display: 'flex' }}>
            <div className="login-content">
                <h1>Welcome to Quiz LM</h1>
                <p className="login-subtitle">Your personalized quiz generation platform.</p>

                <div className="auth-container">
                    <div className="auth-tabs">
                        <button
                            className={`auth-tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                            onClick={() => setActiveTab('signin')}
                        >Sign In</button>
                        <button
                            className={`auth-tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                            onClick={() => setActiveTab('signup')}
                        >Sign Up</button>
                    </div>

                    <div id="auth-form-content">
                        {activeTab === 'signin' ? (
                            <form className="auth-form active" onSubmit={handleSignIn}>
                                <p className="form-intro">Sign in to access your quizzes.</p>
                                <div className="form-control">
                                    <label htmlFor="signin-email">Email</label>
                                    <input type="email" id="signin-email" placeholder="you@example.com" required autoComplete="email"
                                        value={email} onChange={e => setEmail(e.target.value)}/>
                                </div>
                                <div className="form-control">
                                    <label htmlFor="signin-password">Password</label>
                                    <input type="password" id="signin-password" placeholder="••••••••" required autoComplete="current-password"
                                        value={password} onChange={e => setPassword(e.target.value)} />
                                </div>
                                <button type="submit" className="auth-submit-btn">Sign In</button>
                            </form>
                        ) : (
                            <form className="auth-form active" onSubmit={handleSignUp}>
                                <p className="form-intro">Create a new account to get started.</p>
                                <div className="form-control">
                                    <label htmlFor="signup-name">Full Name</label>
                                    <input type="text" id="signup-name" placeholder="Your Name" required autoComplete="name"
                                        value={name} onChange={e => setName(e.target.value)}/>
                                </div>
                                <div className="form-control">
                                    <label htmlFor="signup-email">Email</label>
                                    <input type="email" id="signup-email" placeholder="you@example.com" required autoComplete="email"
                                        value={email} onChange={e => setEmail(e.target.value)}/>
                                </div>
                                <div className="form-control">
                                    <label htmlFor="signup-password">Password</label>
                                    <input type="password" id="signup-password" placeholder="Create a password (min. 6 characters)" required autoComplete="new-password"
                                        value={password} onChange={e => setPassword(e.target.value)}/>
                                </div>
                                <div className="consent-section" style={{ display: 'block' }}>
                                    <p>To create an account, please confirm the following:</p>
                                    <div className="consent-item">
                                        <input type="checkbox" id="age-consent-checkbox" checked={consentAge} onChange={e => setConsentAge(e.target.checked)} />
                                        <label htmlFor="age-consent-checkbox">I am 18 years of age or older.</label>
                                    </div>
                                    <div className="consent-item">
                                        <input type="checkbox" id="privacy-consent-checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} />
                                        <label htmlFor="privacy-consent-checkbox">I agree to the <a href="#">Privacy Policy</a>.</label>
                                    </div>
                                </div>
                                <button type="submit" className="auth-submit-btn" disabled={!consentAge || !consentPrivacy}>Create Account</button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="auth-divider"><span>OR</span></div>

                <button id="sign-in-btn" className="google-sign-in-btn" onClick={signInWithGoogle}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google icon"/>
                    <span id="google-btn-text">{activeTab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                </button>
            </div>
        </section>
    );
};
