import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  Trash2,
  Search,
  MapPin,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse } from '../types';
import { Button } from '../components/common/Button';
import { WarehouseModal } from '../components/warehouses/WarehouseModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const WarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await api.getWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this warehouse depot? Connected roads will also be removed.')) {
      return;
    }
    try {
      await api.deleteWarehouse(id);
      loadWarehouses();
    } catch (err) {
      console.error('Failed to delete warehouse:', err);
    }
  };

  const filtered = warehouses.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Emergency Warehouse Depots
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage central logistics supply hubs, inventory levels, and coordinates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search depots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <Button
            onClick={() => {
              setSelectedWarehouse(null);
              setModalOpen(true);
            }}
            icon={Plus}
            size="sm"
          >
            Add Warehouse
          </Button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading warehouse depots..." />}

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((wh) => {
          const totUnits =
            wh.food_stock +
            wh.water_stock +
            wh.medicine_stock +
            wh.blanket_stock +
            wh.emergency_kit_stock;

          return (
            <div
              key={wh.id}
              className="glass-panel p-5 space-y-4 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {wh.name}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 font-bold text-blue-700 dark:text-blue-300">
                      ID: {wh.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    Lat: {wh.latitude.toFixed(4)}, Lng: {wh.longitude.toFixed(4)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedWarehouse(wh);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    title="Edit Warehouse"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 hover:text-red-700 transition-colors"
                    title="Delete Warehouse"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                  <span>Available Inventory Stock</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    Total: {totUnits.toLocaleString()} units
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🥖 Food:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {wh.food_stock.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">💧 Water:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {wh.water_stock.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">💊 Medicine:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {wh.medicine_stock.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🧣 Blankets:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {wh.blanket_stock.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🧰 Emergency Kits:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {wh.emergency_kit_stock.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <WarehouseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        warehouse={selectedWarehouse}
        onSaved={loadWarehouses}
      />
    </div>
  );
};
