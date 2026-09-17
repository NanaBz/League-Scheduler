import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

export default function FantasyGoogleSignIn({ onCredential, onError, label = 'Continue with Google' }) {
  if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <div className="fantasy-google-signin">
      <GoogleLogin
        onSuccess={(response) => {
          if (response?.credential) {
            onCredential(response.credential);
          } else {
            onError?.('Google did not return a sign-in credential.');
          }
        }}
        onError={() => onError?.('Google Sign-In was cancelled or failed.')}
        text="continue_with"
        shape="rectangular"
        width="320"
        locale="en"
        useOneTap={false}
        aria-label={label}
      />
    </div>
  );
}
