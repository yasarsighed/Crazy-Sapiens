'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, AuthError } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: { full_name?: string; role?: string; researcher_color?: string }) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data as Profile
  }, [supabase])

  const setResearcherColor = useCallback((color: string | null) => {
    if (color && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--researcher-color', color)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
      if (profileData?.researcher_color) {
        setResearcherColor(profileData.researcher_color)
      }
    }
  }, [user, fetchProfile, setResearcherColor])

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        setUser(currentUser)
        
        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id)
          setProfile(profileData)
          if (profileData?.researcher_color) {
            setResearcherColor(profileData.researcher_color)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id)
        setProfile(profileData)
        if (profileData?.researcher_color) {
          setResearcherColor(profileData.researcher_color)
        }
      } else {
        setProfile(null)
        setResearcherColor('#2D6A4F') // Reset to default
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile, setResearcherColor])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (
    email: string, 
    password: string, 
    metadata?: { full_name?: string; role?: string; researcher_color?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
          `${window.location.origin}/auth/callback`,
        data: metadata,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setResearcherColor('#2D6A4F')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
