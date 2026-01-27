import React, { useEffect } from 'react';
import { useSessionStore } from '../stores';
import api from '../services/api';
import './App.css';

function App() {
  const { session, isAuthenticated, setSession } = useSessionStore();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { data } = await api.getSession();
        setSession(data);
      } catch (error) {
        // Not authenticated, redirect to login
        console.log('Not authenticated');
      }
    };

    checkAuth();
  }, [setSession]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>FCOM Curation & Management</h1>
        {isAuthenticated && <p>Welcome, {session?.user}</p>}
      </header>
      <main className="app-main">
        {isAuthenticated ? (
          <div>
            <p>Authenticated. Dashboard coming soon...</p>
          </div>
        ) : (
          <div>
            <p>Please log in to continue.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
