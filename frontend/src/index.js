import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const appTree = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>
  ) : (
    appTree
  )
);
