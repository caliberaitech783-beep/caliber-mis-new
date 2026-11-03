import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './app/App.jsx';
import {APP_VERSION} from './app-version.js';
import {ApplicationErrorBoundary} from './components/ui/lazy-feature.jsx';
import EnvironmentBanner from './components/ui/environment-banner.jsx';
import SiteUpdateNotice from './components/ui/site-update-notice.jsx';

document.documentElement.dataset.caliberUiVersion = APP_VERSION;
createRoot(document.getElementById('root')).render(
  <ApplicationErrorBoundary>
    <EnvironmentBanner />
    <SiteUpdateNotice currentVersion={APP_VERSION} />
    <App />
  </ApplicationErrorBoundary>,
);
