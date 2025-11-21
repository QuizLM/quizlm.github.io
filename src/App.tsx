import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QuizProvider } from './context/QuizContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Quiz } from './pages/Quiz';
import { Result } from './pages/Result';
import { Review } from './pages/Review';
import { Loader } from './components/Loader';
import './styles/global.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return <Loader message="Verifying access..." />;
    if (!user) return <Navigate to="/login" />;

    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) return <Loader message="Initializing..." />;

    return (
        <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/quiz/filter" element={<Navigate to="/" />} />
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
            <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />

            {/* Placeholder routes */}
            <Route path="/services" element={<ProtectedRoute><div>Paid Services (Coming Soon)</div></ProtectedRoute>} />
        </Routes>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <QuizProvider>
                <Router>
                    <AppRoutes />
                </Router>
            </QuizProvider>
        </AuthProvider>
    );
}
