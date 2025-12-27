import { createClient } from '@supabase/supabase-js';

// process.env.NEXT_PUBLIC_SUPABASE_URL should be used in production
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uxkzjuisnnevajzfzgnx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a3pqdWlzbm5ldmFqemZ6Z254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzgzOTYsImV4cCI6MjA4MjI1NDM5Nn0.lXbw-xDukQOviup8AnTgzi7YjKMp4BFcqU4b1COYpTU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
