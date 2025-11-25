import { useState } from 'react';
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
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#f2f3f5',
    fontSize: '14px',
  };

  return (
    <div style={appStyles}>
      {isLoggedIn ? <ChatPage onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />}
    </div>
  );
};

export default App;
