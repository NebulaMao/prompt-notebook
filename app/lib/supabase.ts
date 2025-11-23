import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
    return supabaseUrl !== 'https://placeholder.supabase.co' &&
        !supabaseAnonKey.includes('placeholder');
};

export interface Prompt {
    id: string;
    title: string;
    description: string;
    content: string;
    tags: string[];
    author: string;
    likes: number;
    category: 'Coding' | 'Writing' | 'Art' | 'Productivity' | 'Other';
    created_at: string;
    user_id?: string;
}

export type UserRole = 'normal' | 'vip' | 'svip' | 'admin';

export interface UserProfile {
    id: string;
    user_id: string;
    role: UserRole;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}

// Helper function to check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

    if (error || !data) return false;
    return data.role === 'admin';
}

// Helper function to get user's effective role
export async function getUserEffectiveRole(userId: string): Promise<UserRole> {
    const { data, error } = await supabase
        .from('active_user_roles')
        .select('effective_role')
        .eq('user_id', userId)
        .single();

    if (error || !data) return 'normal';
    return data.effective_role as UserRole;
}

// Helper function to check if user's role is active
export async function isUserRoleActive(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('active_user_roles')
        .select('is_active')
        .eq('user_id', userId)
        .single();

    if (error || !data) return false;
    return data.is_active;
}
