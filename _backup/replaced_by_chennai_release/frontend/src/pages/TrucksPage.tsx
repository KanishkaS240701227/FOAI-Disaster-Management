import React, { useState, useEffect } from 'react';
import {
  Truck as TruckIcon,
  Plus,
  Edit2,
  Trash2,
  Weight,
  Fuel,
  Gauge,
  Warehouse,
} from 'lucide-react';
import { api } from '../services/api';
import { Truck, Warehouse as WarehouseType } from '../types';
import { Button } from '../components/common/Button';
import { TruckStatusBadge } from '../components/common/Badge';
import { TruckModal } from '../components/trucks/TruckModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const TrucksPage: React.FC = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [t, w] = await Promise.all([api.getTrucks(), api.getWarehouses()]);
      setTrucks(t);
      setWarehouses(w);
    } catch (err) {
      console.error('Failed to load fleet trucks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const whMap = new Map<string, string>();
  warehouses.forEach((w) => whMap.set(w.id, w.name));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this truck from the relief fleet?')) return;
    try {
      await api.deleteTruck(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete truck:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Emergency Fleet & Relief Trucks
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage transport vehicles, payload capacity limits, speed parameters, and fuel consumption.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedTruck(null);
            setModalOpen(true);
          }}
          icon={Plus}
          size="sm"
        >
          Add Relief Truck
        </Button>
      </div>

      {loading && <LoadingSpinner message="Loading fleet vehicles..." />}

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trucks.map((t) => {
          const whName = whMap.get(t.current_warehouse_id || t.warehouse_id || '') || 'Central Depot';

          return (
            <div
              key={t.id}
              className="glass-panel p-5 space-y-4 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.truck_number}
                    </h3>
                    <TruckStatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Warehouse className="w-3.5 h-3.5 text-blue-500" />
                    Base: <span className="font-semibold text-slate-700 dark:text-slate-300">{whName}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedTruck(t);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                    title="Edit Truck"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 hover:text-red-700"
                    title="Delete Truck"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Weight className="w-3 h-3 text-orange-500" /> Capacity
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {t.capacity.toLocaleString()} units
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-purple-500" /> Fuel Tank
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {t.fuel_capacity} Liters
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-blue-500" /> Avg Speed
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {t.average_speed} km/h
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-emerald-500" /> Burn Rate
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {t.fuel_consumption} L/km
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <TruckModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        truck={selectedTruck}
        warehouses={warehouses}
        onSaved={loadData}
      />
    </div>
  );
};
