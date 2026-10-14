import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Warehouse } from '../../types';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  warehouse?: Warehouse | null;
  onSaved: () => void;
}

export const WarehouseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  warehouse,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(21.65);
  const [longitude, setLongitude] = useState(87.52);
  const [foodStock, setFoodStock] = useState(5000);
  const [waterStock, setWaterStock] = useState(5000);
  const [medicineStock, setMedicineStock] = useState(2000);
  const [blanketStock, setBlanketStock] = useState(3000);
  const [emergencyKitStock, setEmergencyKitStock] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (warehouse) {
      setName(warehouse.name);
      setLatitude(warehouse.latitude);
      setLongitude(warehouse.longitude);
      setFoodStock(warehouse.food_stock);
      setWaterStock(warehouse.water_stock);
      setMedicineStock(warehouse.medicine_stock);
      setBlanketStock(warehouse.blanket_stock);
      setEmergencyKitStock(warehouse.emergency_kit_stock);
    } else {
      setName('');
      setLatitude(21.65);
      setLongitude(87.52);
      setFoodStock(5000);
      setWaterStock(5000);
      setMedicineStock(2000);
      setBlanketStock(3000);
      setEmergencyKitStock(1500);
    }
    setError(null);
  }, [warehouse, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Warehouse name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        food_stock: Number(foodStock),
        water_stock: Number(waterStock),
        medicine_stock: Number(medicineStock),
        blanket_stock: Number(blanketStock),
        emergency_kit_stock: Number(emergencyKitStock),
      };

      if (warehouse) {
        await api.updateWarehouse(warehouse.id, payload);
      } else {
        await api.createWarehouse(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save warehouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={warehouse ? 'Edit Warehouse Depot' : 'Add New Warehouse Depot'}
      subtitle="Configure emergency storage location and available supply stocks"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Warehouse Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Northern Emergency Base"
            className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Latitude (-90 to 90) *
            </label>
            <input
              type="number"
              step="any"
              required
              value={latitude}
              onChange={(e) => setLatitude(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Longitude (-180 to 180) *
            </label>
            <input
              type="number"
              step="any"
              required
              value={longitude}
              onChange={(e) => setLongitude(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
          <label className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-2">
            Available Emergency Supply Stocks (Units):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🥖 Food Stock:</span>
              <input
                type="number"
                min="0"
                value={foodStock}
                onChange={(e) => setFoodStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">💧 Water Stock:</span>
              <input
                type="number"
                min="0"
                value={waterStock}
                onChange={(e) => setWaterStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">💊 Medicine Stock:</span>
              <input
                type="number"
                min="0"
                value={medicineStock}
                onChange={(e) => setMedicineStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🧣 Blanket Stock:</span>
              <input
                type="number"
                min="0"
                value={blanketStock}
                onChange={(e) => setBlanketStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🧰 Emergency Kits:</span>
              <input
                type="number"
                min="0"
                value={emergencyKitStock}
                onChange={(e) => setEmergencyKitStock(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {warehouse ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
