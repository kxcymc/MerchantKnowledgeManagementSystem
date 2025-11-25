import { useState } from 'react';
import { BrowserRouter, Routes, Route, } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { ChatPage } from '@/pages/ChatPage';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const appStyles = {
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#f2f3f5',
    fontSize: '14px',
  };

  return (
    <div style={appStyles}>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              <ChatPage 
                isLoggedIn={isLoggedIn} 
                onLogout={handleLogout} 
              />
            } 
          />
          <Route 
            path="/login" 
            element={
              <LoginPage 
                onLogin={handleLogin} 
              />
            } 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;