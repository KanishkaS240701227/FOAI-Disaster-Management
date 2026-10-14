import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Warehouse, AffectedArea, Road, TruckPlanOutput } from '../../types';

// Center updater helper
const MapCenterController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface ReliefMapProps {
  warehouses: Warehouse[];
  affectedAreas: AffectedArea[];
  roads: Road[];
  truckPlans?: TruckPlanOutput[];
  selectedRouteId?: string | null;
  height?: string;
  onSelectLocation?: (id: string, type: 'warehouse' | 'affected') => void;
}

export const ReliefMap: React.FC<ReliefMapProps> = ({
  warehouses,
  affectedAreas,
  roads,
  truckPlans = [],
  selectedRouteId,
  height = '560px',
  onSelectLocation,
}) => {
  // Compute default center
  const center: [number, number] = useMemo(() => {
    if (warehouses.length > 0) {
      return [warehouses[0].latitude, warehouses[0].longitude];
    }
    if (affectedAreas.length > 0) {
      return [affectedAreas[0].latitude, affectedAreas[0].longitude];
    }
    return [21.65, 87.52]; // Default scenario region
  }, [warehouses, affectedAreas]);

  // Create node coordinate lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; name: string; type: 'wh' | 'aff'; obj: any }>();
    warehouses.forEach((w) => {
      map.set(w.id, { lat: w.latitude, lng: w.longitude, name: w.name, type: 'wh', obj: w });
    });
    affectedAreas.forEach((a) => {
      map.set(a.id, { lat: a.latitude, lng: a.longitude, name: a.name, type: 'aff', obj: a });
    });
    return map;
  }, [warehouses, affectedAreas]);

  // Warehouse Custom Icon
  const createWarehouseIcon = (name: string) => {
    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `
        <div class="relative group cursor-pointer">
          <div class="w-8 h-8 rounded-xl bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform">
            🏢
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  // Affected Area Custom Icon
  const createAffectedIcon = (severity: string) => {
    const colorMap: Record<string, string> = {
      Critical: 'bg-red-600 ring-4 ring-red-400/50 animate-pulse',
      High: 'bg-orange-500 ring-2 ring-orange-400/40',
      Medium: 'bg-amber-500 ring-2 ring-amber-400/30',
      Low: 'bg-emerald-500 ring-2 ring-emerald-400/30',
    };
    const cls = colorMap[severity] || colorMap.Medium;

    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `
        <div class="relative cursor-pointer">
          <div class="w-7 h-7 rounded-full ${cls} border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform">
            ⚠️
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  // Route colors for distinct trucks
  const routeColors = ['#2563eb', '#ea580c', '#8b5cf6', '#059669', '#d97706', '#db2777'];

  return (
    <div
      style={{ height }}
      className="w-full relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner z-0"
    >
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapCenterController center={center} zoom={10} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Base Road Network */}
        {roads.map((road) => {
          const src = nodeMap.get(road.source_id);
          const dst = nodeMap.get(road.destination_id);
          if (!src || !dst) return null;

          const isBlocked = (road.road_status || road.status) === 'Blocked';
          const isRepair = (road.road_status || road.status) === 'Under Repair';

          const color = isBlocked ? '#ef4444' : isRepair ? '#f59e0b' : '#10b981';
          const dashArray = isBlocked ? '8, 8' : isRepair ? '4, 4' : undefined;
          const weight = isBlocked ? 4 : 3;
          const opacity = isBlocked ? 0.9 : 0.6;

          return (
            <Polyline
              key={road.id}
              positions={[
                [src.lat, src.lng],
                [dst.lat, dst.lng],
              ]}
              pathOptions={{
                color,
                dashArray,
                weight,
                opacity,
              }}
            >
              <Tooltip sticky>
                <div className="text-xs p-1">
                  <p className="font-bold text-slate-800">
                    {src.name} ⟷ {dst.name}
                  </p>
                  <p className="text-slate-600">
                    Distance: {road.distance} km | Status:{' '}
                    <span
                      className={
                        isBlocked
                          ? 'text-red-600 font-bold'
                          : isRepair
                          ? 'text-amber-600 font-bold'
                          : 'text-emerald-600 font-bold'
                      }
                    >
                      {road.road_status || road.status}
                    </span>
                  </p>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Optimal Truck Routes (A* & GA results) */}
        {truckPlans.map((plan, idx) => {
          if (!plan.optimal_route_coordinates || plan.optimal_route_coordinates.length < 2) return null;

          const isSelected = selectedRouteId === plan.truck_id;
          const color = routeColors[idx % routeColors.length];

          return (
            <Polyline
              key={`plan-${plan.truck_id}`}
              positions={plan.optimal_route_coordinates}
              pathOptions={{
                color: isSelected ? '#3b82f6' : color,
                weight: isSelected ? 6 : 4.5,
                opacity: isSelected ? 1.0 : 0.85,
              }}
            >
              <Tooltip sticky>
                <div className="text-xs p-1 space-y-1">
                  <p className="font-bold text-blue-700">
                    🚚 {plan.truck_number} Optimal Route
                  </p>
                  <p className="text-slate-600">
                    Depot: {plan.warehouse_name} ➔ {plan.assigned_locations.length} stop(s)
                  </p>
                  <p className="text-slate-600">
                    Distance: {plan.distance_km} km | Time: {plan.estimated_time_hours}h | Fuel: {plan.fuel_usage_liters}L
                  </p>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Warehouse Markers */}
        {warehouses.map((wh) => (
          <Marker
            key={wh.id}
            position={[wh.latitude, wh.longitude]}
            icon={createWarehouseIcon(wh.name)}
            eventHandlers={{
              click: () => onSelectLocation && onSelectLocation(wh.id, 'warehouse'),
            }}
          >
            <Popup>
              <div className="p-1 space-y-2 text-xs min-w-[200px]">
                <div className="border-b pb-1">
                  <span className="text-[10px] font-bold uppercase text-blue-600">
                    Emergency Supply Depot
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{wh.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Coords: {wh.latitude.toFixed(4)}, {wh.longitude.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 mb-1">Available Inventory:</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <span>🥖 Food: <b>{wh.food_stock.toLocaleString()}</b></span>
                    <span>💧 Water: <b>{wh.water_stock.toLocaleString()}</b></span>
                    <span>💊 Meds: <b>{wh.medicine_stock.toLocaleString()}</b></span>
                    <span>🧣 Blankets: <b>{wh.blanket_stock.toLocaleString()}</b></span>
                    <span>🧰 Kits: <b>{wh.emergency_kit_stock.toLocaleString()}</b></span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Affected Disaster Area Markers */}
        {affectedAreas.map((area) => (
          <Marker
            key={area.id}
            position={[area.latitude, area.longitude]}
            icon={createAffectedIcon(area.severity)}
            eventHandlers={{
              click: () => onSelectLocation && onSelectLocation(area.id, 'affected'),
            }}
          >
            <Popup>
              <div className="p-1 space-y-2 text-xs min-w-[210px]">
                <div className="border-b pb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-red-600">
                      Disaster Impact Zone
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        area.severity === 'Critical'
                          ? 'bg-red-100 text-red-700'
                          : area.severity === 'High'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {area.severity}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{area.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Pop: {area.population.toLocaleString()} | Coords: {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 mb-1">Urgent Demands:</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                    <span>🥖 Food: <b>{area.food_demand.toLocaleString()}</b></span>
                    <span>💧 Water: <b>{area.water_demand.toLocaleString()}</b></span>
                    <span>💊 Meds: <b>{area.medicine_demand.toLocaleString()}</b></span>
                    <span>🧣 Blankets: <b>{area.blanket_demand.toLocaleString()}</b></span>
                    <span>🧰 Kits: <b>{area.emergency_kit_demand.toLocaleString()}</b></span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
