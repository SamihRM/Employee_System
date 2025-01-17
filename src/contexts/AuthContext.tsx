import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setUser(profile);
      return profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      setUser(null);
      return null;
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    setLoading(true);
    try {
      // Sign up the user with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });
  
      if (signUpError) throw signUpError;
  
      // Insert the profile into the profiles table
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: data.user.id, // Use the user's ID from Supabase
            first_name: firstName,
            last_name: lastName,
            role: 'employee', // Default role for new sign-ups
          }]);
  
        if (profileError) throw profileError;
  
        // Redirect to the login page after successful sign-up
        navigate('/anmelden');
      } else {
        console.error('Sign-up succeeded, but no user returned:', data);
      }
    } catch (error) {
      console.error('Error during sign-up:', error);
      throw error; // Handle the error in the sign-up form
    } finally {
      setLoading(false);
    }
  };
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await fetchProfile(data.user.id);
      if (profile) {
        const targetPath = profile.role === 'admin' ? '/admin' : '/mitarbeiter';
        navigate(targetPath);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      navigate('/anmelden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}