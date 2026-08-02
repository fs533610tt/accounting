import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 取得當前 Session 與權限
    const fetchSessionAndRoles = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // 從 user_roles 取得該使用者的角色
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('role, team_id, teams(name, status)')
          .eq('user_id', session.user.id);
          
        if (!error && roles) {
          setUserRoles(roles);
        }
      } else {
        setUserRoles([]);
      }
      setLoading(false);
    };

    fetchSessionAndRoles();

    // 監聽登入狀態改變
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, team_id, teams(name, status)')
          .eq('user_id', newSession.user.id);
        setUserRoles(roles || []);
      } else {
        setUserRoles([]);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const isSuperAdmin = userRoles.some(r => r.role === 'superadmin');

  const value = {
    session,
    user: session?.user ?? null,
    userRoles,
    isSuperAdmin,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
