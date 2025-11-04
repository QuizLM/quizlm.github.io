
import { createClient } from '@supabase/supabase-js';

// --- TEMPORARY FIX FOR PREVIEW IDE ---
// This preview environment does not load custom secrets into environment variables.
// Please replace the placeholder below with your actual Supabase anon key to run the app.
// IMPORTANT: Do not commit real keys to a public repository. Use your hosting provider's secret manager for production.
const supabaseUrl = 'https://sjcfagpjstbfxuiwhlps.supabase.co';
const supabaseAnonKey = 'PASTE_YOUR_SUPABASE_ANON_KEY_HERE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
