import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uxkzjuisnnevajzfzgnx.supabase.co').trim();
    const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a3pqdWlzbm5ldmFqemZ6Z254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzgzOTYsImV4cCI6MjA4MjI1NDM5Nn0.lXbw-xDukQOviup8AnTgzi7YjKMp4BFcqU4b1COYpTU').trim();

    if (!url.startsWith('http')) {
        console.error('Invalid Supabase URL');
        return { url, key };
    }
    return { url, key };
};

const { url, key } = getSupabaseConfig();
export const supabase = createClient(url, key);
