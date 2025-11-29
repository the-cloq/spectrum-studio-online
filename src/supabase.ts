import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://wmauypsowrtddedkomhp.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtYXV5cHNvd3J0ZGRlZGtvbWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMDMzNjEsImV4cCI6MjA3OTg3OTM2MX0.vzofpmYr-kQP-Lk5ufu0gVMSYtM-gNflSMbcpqX5bA4"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
