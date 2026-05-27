import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useProdigyStore } from './store';
import { useScrollPosition } from './hooks/useScrollPosition';
import PageTransition from './components/PageTransition';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Quests = lazy(() => import('./pages/Quests'));
const Shop = lazy(() => import('./pages/Shop'));
const DomainView = lazy(() => import('./pages/DomainView'));
const ProfessionalDevelopment = lazy(() => import('./pages/ProfessionalDevelopment'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

// App content wrapper to handle scroll position
const AppContent: React.FC = () => {
  const { initializeAuth, authLoading } = useProdigyStore();
  const location = useLocation();
  useScrollPosition();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (authLoading) {
    return <LoadingSpinner fullScreen message="Initializing Prodigy Protocol" />;
  }

  return (
    <PageTransition>
      <Suspense fallback={<LoadingSpinner message="Loading page" />}>
        <Routes location={location}>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute requiredRole="guest">
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute requiredRole="user">
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/quests" 
            element={
              <ProtectedRoute requiredRole="guest">
                <Quests />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/shop" 
            element={
              <ProtectedRoute requiredRole="user">
                <Shop />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/domain/:domain" 
            element={
              <ProtectedRoute requiredRole="guest">
                <DomainView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/professional" 
            element={
              <ProtectedRoute requiredRole="user">
                <ProfessionalDevelopment />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
