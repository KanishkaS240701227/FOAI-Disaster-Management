import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AffectedArea, SeverityLevel } from '../../types';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  area?: AffectedArea | null;
  onSaved: () => void;
}

export const AffectedAreaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  area,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(21.62);
  const [longitude, setLongitude] = useState(87.50);
  const [population, setPopulation] = useState(25000);
  const [severity, setSeverity] = useState<SeverityLevel>('High');
  const [foodDemand, setFoodDemand] = useState(1500);
  const [waterDemand, setWaterDemand] = useState(3000);
  const [medicineDemand, setMedicineDemand] = useState(500);
  const [blanketDemand, setBlanketDemand] = useState(800);
  const [emergencyKitDemand, setEmergencyKitDemand] = useState(400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (area) {
      setName(area.name);
      setLatitude(area.latitude);
      setLongitude(area.longitude);
      setPopulation(area.population);
      setSeverity(area.severity);
      setFoodDemand(area.food_demand);
      setWaterDemand(area.water_demand);
      setMedicineDemand(area.medicine_demand);
      setBlanketDemand(area.blanket_demand);
      setEmergencyKitDemand(area.emergency_kit_demand);
    } else {
      setName('');
      setLatitude(21.62);
      setLongitude(87.50);
      setPopulation(25000);
      setSeverity('High');
      setFoodDemand(1500);
      setWaterDemand(3000);
      setMedicineDemand(500);
      setBlanketDemand(800);
      setEmergencyKitDemand(400);
    }
    setError(null);
  }, [area, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Area name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        population: Number(population),
        severity,
        food_demand: Number(foodDemand),
        water_demand: Number(waterDemand),
        medicine_demand: Number(medicineDemand),
        blanket_demand: Number(blanketDemand),
        emergency_kit_demand: Number(emergencyKitDemand),
      };

      if (area) {
        await api.updateAffectedArea(area.id, payload);
      } else {
        await api.createAffectedArea(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save affected area');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={area ? 'Edit Disaster Location' : 'Register New Disaster Impact Zone'}
      subtitle="Define affected population, severity tier, and urgent supply demands"
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
              Location / Area Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Digha Coastal Village"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Disaster Severity Level *
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="Low">Low (Routine Relief)</option>
              <option value="Medium">Medium (Moderate Shortage)</option>
              <option value="High">High (Severe Impact)</option>
              <option value="Critical">Critical (Life-Threatening Emergency)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Population *
            </label>
            <input
              type="number"
              min="1"
              required
              value={population}
              onChange={(e) => setPopulation(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Latitude *
            </label>
            <input
              type="number"
              step="any"
              required
              value={latitude}
              onChange={(e) => setLatitude(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Longitude *
            </label>
            <input
              type="number"
              step="any"
              required
              value={longitude}
              onChange={(e) => setLongitude(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
          <label className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-2">
            Resource Demands (Units):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🥖 Food Demand:</span>
              <input
                type="number"
                min="0"
                value={foodDemand}
                onChange={(e) => setFoodDemand(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">💧 Water Demand:</span>
              <input
                type="number"
                min="0"
                value={waterDemand}
                onChange={(e) => setWaterDemand(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">💊 Medicine Demand:</span>
              <input
                type="number"
                min="0"
                value={medicineDemand}
                onChange={(e) => setMedicineDemand(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🧣 Blanket Demand:</span>
              <input
                type="number"
                min="0"
                value={blanketDemand}
                onChange={(e) => setBlanketDemand(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">🧰 Emergency Kits:</span>
              <input
                type="number"
                min="0"
                value={emergencyKitDemand}
                onChange={(e) => setEmergencyKitDemand(Number(e.target.value))}
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
            {area ? 'Update Disaster Area' : 'Register Disaster Area'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
