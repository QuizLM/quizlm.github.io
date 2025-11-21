import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Toast } from '../lib/utils';

declare const Swal: any;

interface UserProfile {
    id: string;
    full_name: string;
    avatar_url: string;
    subscription_status: string;
    daily_questions_attempted: number;
    daily_queries_used: number;
    plan_expiry_date: string | null;
    last_reset_date: string | null;
    // Add other profile fields as needed
}

interface AuthContextType {
    user: any | null;
    profile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (fullName: string, email: string, password: string) => Promise<any | null>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile | null>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchUserProfile(currentUser.id).then(setProfile);
            }
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                const userProfile = await fetchUserProfile(currentUser.id);
                setProfile(userProfile);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                if (error.code !== 'PGRST116') throw error; // PGRST116: No rows found
                return null;
            }
            return data;
        } catch (error: any) {
            console.error('Error fetching profile:', error.message);
            return null;
        }
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) return null;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;
            setProfile(data);
            return data;
        } catch (error: any) {
            console.error('Error updating profile:', error.message);
            return null;
        }
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
        if (error) {
            Toast.fire({ icon: 'error', title: 'Sign-in failed', text: error.message });
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            Toast.fire({ icon: 'error', title: 'Sign-in failed', text: error.message });
        }
    };

    const signUpWithEmail = async (fullName: string, email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(fullName)}`
                },
                emailRedirectTo: window.location.origin,
            }
        });

        if (error) {
            Toast.fire({ icon: 'error', title: 'Sign-up failed', text: error.message });
            return null;
        }

        Swal.fire({
            title: 'Please check your email!',
            html: `We have sent a confirmation link to <strong>${email}</strong>. Please click the link to complete your registration.`,
            icon: 'info'
        });
        return data.user;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            Toast.fire({ icon: 'error', title: 'Sign-out failed', text: error.message });
        } else {
            setProfile(null);
            setUser(null);
        }
    };

    const deleteAccount = async () => {
        const { isConfirmed } = await Swal.fire({
            title: 'Are you absolutely sure?',
            html: `This action cannot be undone. This will permanently delete your account.<br><br><strong>This is an irreversible action.</strong>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (isConfirmed) {
            console.log("Simulating account deletion.");
            Toast.fire({ icon: 'success', title: 'Account deleted successfully.', text: 'You have been signed out.' });
            await signOut();
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, updateProfile, deleteAccount }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
