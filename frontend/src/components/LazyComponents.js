import { lazy } from 'react';

// Lazy load components to reduce initial bundle size
export const UserView = lazy(() => import('./UserView'));
export const AdminPanel = lazy(() => import('./AdminPanel'));
