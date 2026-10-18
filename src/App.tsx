import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from './tabs/TabBar';
import { KaartTab } from './tabs/KaartTab';
import { BergTab } from './tabs/BergTab';
import { AiTab } from './tabs/AiTab';
import { HuisTab } from './tabs/HuisTab';
import { PlanningTab } from './tabs/PlanningTab';

export function AppRoutes() {
  return (
    <div className="shell">
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/kaart" replace />} />
          <Route path="/kaart" element={<KaartTab />} />
          <Route path="/berg" element={<BergTab />} />
          <Route path="/ai" element={<AiTab />} />
          <Route path="/huis" element={<HuisTab />} />
          <Route path="/planning" element={<PlanningTab />} />
          <Route path="*" element={<Navigate to="/kaart" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
