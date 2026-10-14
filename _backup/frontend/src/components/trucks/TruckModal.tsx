import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Truck, TruckStatus, Warehouse } from '../../types';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  truck?: Truck | null;
  warehouses: Warehouse[];
  onSaved: () => void;
}

export const TruckModal: React.FC<Props> = ({
  isOpen,
  onClose,
  truck,
  warehouses,
  onSaved,
}) => {
  const [truckNumber, setTruckNumber] = useState('');
  const [capacity, setCapacity] = useState(6000);
  const [fuelCapacity, setFuelCapacity] = useState(300);
  const [averageSpeed, setAverageSpeed] = useState(55);
  const [fuelConsumption, setFuelConsumption] = useState(0.28);
  const [currentWarehouseId, setCurrentWarehouseId] = useState('');
  const [status, setStatus] = useState<TruckStatus>('Available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (truck) {
      setTruckNumber(truck.truck_number);
      setCapacity(truck.capacity);
      setFuelCapacity(truck.fuel_capacity);
      setAverageSpeed(truck.average_speed);
      setFuelConsumption(truck.fuel_consumption);
      setCurrentWarehouseId(truck.current_warehouse_id || truck.warehouse_id || '');
      setStatus(truck.status);
    } else {
      setTruckNumber(`TRK-${Math.floor(100 + Math.random() * 900)}`);
      setCapacity(6000);
      setFuelCapacity(300);
      setAverageSpeed(55);
      setFuelConsumption(0.28);
      setCurrentWarehouseId(warehouses[0]?.id || '');
      setStatus('Available');
    }
    setError(null);
  }, [truck, warehouses, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNumber.trim()) {
      setError('Truck ID / Number is required');
      return;
    }
    if (!currentWarehouseId) {
      setError('Home warehouse depot is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        truck_number: truckNumber,
        capacity: Number(capacity),
        fuel_capacity: Number(fuelCapacity),
        average_speed: Number(averageSpeed),
        fuel_consumption: Number(fuelConsumption),
        current_warehouse_id: currentWarehouseId,
        status,
      };

      if (truck) {
        await api.updateTruck(truck.id, payload);
      } else {
        await api.createTruck(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save truck');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={truck ? 'Edit Relief Truck' : 'Register Relief Truck into Fleet'}
      subtitle="Configure truck payload capacity, fuel tank limit, and home depot"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Truck ID / License Number *
            </label>
            <input
              type="text"
              required
              value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}
              placeholder="e.g. TRK-ECHO-101"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Home Warehouse Depot *
            </label>
            <select
              value={currentWarehouseId}
              onChange={(e) => setCurrentWarehouseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Payload Capacity (Units/kg) *
            </label>
            <input
              type="number"
              min="100"
              required
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Fuel Tank Capacity (Liters) *
            </label>
            <input
              type="number"
              min="50"
              required
              value={fuelCapacity}
              onChange={(e) => setFuelCapacity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Avg Speed (km/h) *
            </label>
            <input
              type="number"
              min="10"
              max="120"
              required
              value={averageSpeed}
              onChange={(e) => setAverageSpeed(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Fuel Consumption (L/km) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.05"
              required
              value={fuelConsumption}
              onChange={(e) => setFuelConsumption(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Operational Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TruckStatus)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold"
            >
              <option value="Available">Available for Dispatch</option>
              <option value="Busy">Busy on Mission</option>
              <option value="In Maintenance">In Maintenance</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {truck ? 'Update Truck' : 'Register Truck'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
