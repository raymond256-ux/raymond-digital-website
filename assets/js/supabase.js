// Raymond Digital - Supabase Connection

const SUPABASE_URL = "https://jirvxaavnlbbhblahbdj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_PHzJcolmVGNtMajUT-CziQ_D2ljsG6C";

const raymondSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

console.log("Raymond Digital: Supabase client initialized successfully.");
console.log("Raymond Supabase client:", raymondSupabase);