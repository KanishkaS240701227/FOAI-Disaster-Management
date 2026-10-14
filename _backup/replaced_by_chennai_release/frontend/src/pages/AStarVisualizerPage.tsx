import React, { useState, useEffect } from 'react';
import { AStarVisualizer } from '../components/visualizer/AStarVisualizer';
import { api } from '../services/api';
import { Warehouse, AffectedArea } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const AStarVisualizerPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [affectedAreas, setAffectedAreas] = useState<AffectedArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getWarehouses(), api.getAffectedAreas()])
      .then(([w, a]) => {
        setWarehouses(w);
        setAffectedAreas(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading graph nodes for A* Visualizer..." />;
  }

  return (
    <div className="space-y-6">
      <AStarVisualizer warehouses={warehouses} affectedAreas={affectedAreas} />
    </div>
  );
};
