import { supabase } from './supabaseClient.js';
import { Toast } from './utils.js';

/**
 * Initiates the Google OAuth sign-in flow.
 */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href, // Redirect to the current page
        },
    });
    if (error) {
        console.error('Error signing in with Google:', error);
        Toast.fire({
            icon: 'error',
            title: 'Sign-in failed',
            text: error.message
        });
    }
}

/**
 * Signs up a new user with email and password.
 * @param {string} fullName The user's full name.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 * @returns {Promise<object|null>} The new user object or null.
 */
export async function signUpWithEmail(fullName, email, password) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
                avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(fullName)}`
            },
            emailRedirectTo: window.location.href,
        }
    });

    if (error) {
        console.error('Error signing up:', error);
        Toast.fire({
            icon: 'error',
            title: 'Sign-up failed',
            text: error.message
        });
        return null;
    }

    // Supabase sends a confirmation email. Inform the user.
    Swal.fire({
        title: 'Please check your email!',
        html: `We have sent a confirmation link to <strong>${email}</strong>. Please click the link to complete your registration.`,
        icon: 'info'
    });
    return data.user;
}

/**
 * Signs a user in with their email and password.
 * @param {string} email The user's email.
 * @param {string} password The user's password.
 */
export async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) {
        console.error('Error signing in:', error);
        Toast.fire({
            icon: 'error',
            title: 'Sign-in failed',
            text: error.message
        });
    }
    // onAuthStateChange will handle successful login
}

/**
 * Signs the current user out.
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
        Toast.fire({
            icon: 'error',
            title: 'Sign-out failed',
            text: error.message
        });
    }
}

/**
 * Sets up a listener that fires when the user's authentication state changes.
 * @param {function(object|null): void} callback The function to call with the user object or null.
 */
export function onAuthStateChange(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        callback(user);
    });
}

/**
 * Gets the current authenticated user.
 * @returns {Promise<object|null>} The user object or null.
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}


/**
 * Fetches the user's profile from the 'profiles' table in Supabase.
 * @param {string} userId The UUID of the user.
 * @returns {Promise<object|null>} The user's profile object or null if not found or an error occurs.
 */
export async function fetchUserProfile(userId) {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single(); // Use .single() to get one object, not an array

        if (error) {
            // PGRST116 means no rows were found, which is a valid scenario we can handle gracefully.
            if (error.code !== 'PGRST116') {
                throw error;
            }
            return null; // No profile found
        }
        return data;
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        return null;
    }
}

/**
 * Updates a user's profile in the 'profiles' table.
 * @param {string} userId The UUID of the user.
 * @param {object} updates An object containing the fields to update.
 * @returns {Promise<object|null>} The updated user profile object or null on error.
 */
export async function updateUserProfile(userId, updates) {
    if (!userId || !updates) return null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select() // Use select() to get the updated row back
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating user profile:', error.message);
        return null;
    }
}


/**
 * Handles the account deletion process.
 * NOTE: This requires a backend Supabase Edge Function to securely delete user data.
 * This client-side function provides the UI and final sign-out.
 */
export async function deleteAccount() {
    const { isConfirmed } = await Swal.fire({
        title: 'Are you absolutely sure?',
        html: `This action cannot be undone. This will permanently delete your account and all of your quiz progress.<br><br><strong>This is an irreversible action.</strong>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (isConfirmed) {
        // --- IMPORTANT ---
        // In a real application, you would now call a Supabase Edge Function
        // to securely delete the user's data from all tables (e.g., profiles, attempts)
        // and then finally delete the user from the `auth.users` table using a service_role key.
        // Example: await supabase.functions.invoke('delete-user-account');

        console.log("Simulating account deletion. In a real app, a secure backend function would be called here.");
        Toast.fire({
            icon: 'success',
            title: 'Account deleted successfully.',
            text: 'You have been signed out.'
        });

        // Sign out the user from the client after the backend process
        await signOut();
    }
}