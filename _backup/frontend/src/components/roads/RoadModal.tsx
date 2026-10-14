import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Road, RoadCondition, RoadStatus, Warehouse, AffectedArea } from '../../types';
import { api } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  road?: Road | null;
  warehouses: Warehouse[];
  affectedAreas: AffectedArea[];
  onSaved: () => void;
}

export const RoadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  road,
  warehouses,
  affectedAreas,
  onSaved,
}) => {
  const allNodes = [
    ...warehouses.map((w) => ({ id: w.id, name: `[Depot] ${w.name}` })),
    ...affectedAreas.map((a) => ({ id: a.id, name: `[Zone] ${a.name}` })),
  ];

  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [distance, setDistance] = useState(25.0);
  const [travelTime, setTravelTime] = useState(0.5);
  const [condition, setCondition] = useState<RoadCondition>('Paved');
  const [status, setStatus] = useState<RoadStatus>('Open');
  const [oneWay, setOneWay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (road) {
      setSourceId(road.source_id);
      setDestinationId(road.destination_id);
      setDistance(road.distance);
      setTravelTime(road.travel_time);
      setCondition(road.road_condition || road.condition || 'Paved');
      setStatus(road.road_status || road.status || 'Open');
      setOneWay(road.one_way || false);
    } else {
      setSourceId(allNodes[0]?.id || '');
      setDestinationId(allNodes[1]?.id || '');
      setDistance(25.0);
      setTravelTime(0.5);
      setCondition('Paved');
      setStatus('Open');
      setOneWay(false);
    }
    setError(null);
  }, [road, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !destinationId) {
      setError('Source and Destination are required');
      return;
    }
    if (sourceId === destinationId) {
      setError('Source and Destination cannot be the same node');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = {
        source_id: sourceId,
        destination_id: destinationId,
        distance: Number(distance),
        travel_time: Number(travelTime),
        road_condition: condition,
        road_status: status,
        one_way: oneWay,
      };

      if (road) {
        await api.updateRoad(road.id, payload);
      } else {
        await api.createRoad(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save road');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={road ? 'Edit Road Segment' : 'Create Road Link'}
      subtitle="Connect disaster nodes and configure road condition and transit status"
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
              Source Location *
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium"
            >
              {allNodes.map((n) => (
                <option key={`src-${n.id}`} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Destination Location *
            </label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium"
            >
              {allNodes.map((n) => (
                <option key={`dst-${n.id}`} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Distance (km) *
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={distance}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDistance(d);
                setTravelTime(Number((d / 50.0).toFixed(2)));
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Est. Travel Time (hours) *
            </label>
            <input
              type="number"
              step="0.05"
              min="0.01"
              required
              value={travelTime}
              onChange={(e) => setTravelTime(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Road Condition
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as RoadCondition)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
            >
              <option value="Paved">Paved (Standard speed)</option>
              <option value="Unpaved">Unpaved (1.25x Cost Multiplier)</option>
              <option value="Damaged">Damaged (1.5x Cost Multiplier)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Road Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoadStatus)}
              className={`w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border font-bold ${
                status === 'Blocked'
                  ? 'text-red-600 border-red-400 dark:border-red-600'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <option value="Open">Open (Fully Passable)</option>
              <option value="Blocked">Blocked (STRICTLY AVOIDED BY A*)</option>
              <option value="Under Repair">Under Repair (Reduced capacity)</option>
            </select>
          </div>
        </div>

        {status === 'Blocked' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold">
            ⚠️ <b>A* AI Search Guarantee:</b> Any road marked as &quot;Blocked&quot; will be completely pruned and never utilized in routing plans.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {road ? 'Update Road' : 'Create Road'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
