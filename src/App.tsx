import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TabBar } from './tabs/TabBar';
import { KaartTab } from './tabs/KaartTab';
import { BergTab } from './tabs/BergTab';
import { AiTab } from './tabs/AiTab';
import { HuisTab } from './tabs/HuisTab';
import { PlanningTab } from './tabs/PlanningTab';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';

function SignedInShell() {
  const { session, loading } = useAuth();
  if (loading) return <div className="page muted">Laden…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="shell">
      <main className="content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

function PublicShell() {
  return (
    <div className="shell">
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registreer" element={<RegisterPage />} />
      </Route>
      <Route element={<SignedInShell />}>
        <Route path="/" element={<Navigate to="/kaart" replace />} />
        <Route path="/kaart" element={<KaartTab />} />
        <Route path="/berg" element={<BergTab />} />
        <Route path="/ai" element={<AiTab />} />
        <Route path="/huis" element={<HuisTab />} />
        <Route path="/planning" element={<PlanningTab />} />
        <Route path="*" element={<Navigate to="/kaart" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
