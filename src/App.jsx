import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './config/supabaseClient';
import Login from './pages/Login';
import './App.css';

const Dashboard = ({ user, onLogout }) => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <div className="glass-panel" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>歡迎，{user.email}！</h2>
      <p>目前您已成功登入系統，後續我們將在此實作各項記帳與教練功能。</p>
      <button className="btn-primary" onClick={onLogout} style={{ marginTop: '20px', maxWidth: '200px', margin: '20px auto' }}>
        登出
      </button>
    </div>
  </div>
);

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 檢查目前 Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 監聽驗證狀態改變
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>載入中...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={session ? <Dashboard user={session.user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
