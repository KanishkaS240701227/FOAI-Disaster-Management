import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { PlannerPage } from './pages/PlannerPage';
import { MapPage } from './pages/MapPage';
import { AStarVisualizerPage } from './pages/AStarVisualizerPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { AffectedAreasPage } from './pages/AffectedAreasPage';
import { RoadNetworkPage } from './pages/RoadNetworkPage';
import { TrucksPage } from './pages/TrucksPage';
import { ReportsPage } from './pages/ReportsPage';
import { DistributionPlanResponse } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [latestPlan, setLatestPlan] = useState<DistributionPlanResponse | null>(null);

  const handleScenarioLoaded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handlePlanGenerated = (plan: DistributionPlanResponse) => {
    setLatestPlan(plan);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <Navbar
        onScenarioLoaded={handleScenarioLoaded}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <DashboardPage
              key={`dash-${refreshKey}`}
              onNavigate={(tab) => setActiveTab(tab)}
              onPlanGenerated={handlePlanGenerated}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerPage
              key={`plan-${refreshKey}`}
              initialPlan={latestPlan}
              onPlanGenerated={handlePlanGenerated}
            />
          )}

          {activeTab === 'map' && <MapPage key={`map-${refreshKey}`} />}

          {activeTab === 'visualizer-astar' && (
            <AStarVisualizerPage key={`astar-${refreshKey}`} />
          )}

          {activeTab === 'warehouses' && (
            <WarehousesPage key={`wh-${refreshKey}`} />
          )}

          {activeTab === 'affected' && (
            <AffectedAreasPage key={`aff-${refreshKey}`} />
          )}

          {activeTab === 'roads' && (
            <RoadNetworkPage key={`road-${refreshKey}`} />
          )}

          {activeTab === 'trucks' && (
            <TrucksPage key={`truck-${refreshKey}`} />
          )}

          {activeTab === 'reports' && (
            <ReportsPage key={`rep-${refreshKey}`} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
