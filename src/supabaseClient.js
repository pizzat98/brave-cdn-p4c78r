import { createClient } from "@supabase/supabase-js";

// Safe lookup for React / CodeSandbox environment variables
const supabaseUrl =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_SUPABASE_URL) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.VITE_SUPABASE_URL) ||
  "";

const supabaseAnonKey =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" &&
    process.env &&
    process.env.VITE_SUPABASE_ANON_KEY) ||
  "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
