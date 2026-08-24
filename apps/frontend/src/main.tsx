import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { bootstrapCsrf } from './api-client/client';
import './styles.css';

// Fire-and-forget: fetch the CSRF token before any state-changing requests
// are made. Does not block render — the token will be set asynchronously and
// applied to the first POST that follows (login), which is always a user-
// initiated action and will arrive well after the token is populated.
bootstrapCsrf();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
