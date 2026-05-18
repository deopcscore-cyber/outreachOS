import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProspectSearch from './pages/ProspectSearch';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Unsubscribe from './pages/Unsubscribe';
import Outbox from './pages/Outbox';
import WarmLeads from './pages/WarmLeads';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/prospects" element={<ProtectedRoute><Layout><ProspectSearch /></Layout></ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute><Layout><Campaigns /></Layout></ProtectedRoute>} />
      <Route path="/campaigns/:id" element={<ProtectedRoute><Layout><CampaignDetail /></Layout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/outbox" element={<ProtectedRoute><Layout><Outbox /></Layout></ProtectedRoute>} />
      <Route path="/warm-leads" element={<ProtectedRoute><Layout><WarmLeads /></Layout></ProtectedRoute>} />
      <Route path="/suppression" element={<ProtectedRoute><Layout><Unsubscribe /></Layout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
