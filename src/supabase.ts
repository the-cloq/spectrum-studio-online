import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://vogxkbzuswsnqbjnapvi.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZ3hrYnp1c3dzbnFiam5hcHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MzI4MzAsImV4cCI6MjA3OTUwODgzMH0.XeoL0tgty5ubQ5GGUhmwhVXldk1byEHGi9AM7eNQj30"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
