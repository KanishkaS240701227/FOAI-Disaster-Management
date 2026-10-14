import React from 'react';
import { DistributionPlanResponse, AffectedArea } from '../../types';
import { SeverityBadge } from '../common/Badge';

interface Props {
  plan: DistributionPlanResponse;
  affectedAreas: AffectedArea[];
}

export const ResourceFulfillmentTable: React.FC<Props> = ({
  plan,
  affectedAreas,
}) => {
  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Resource Demand & Delivery Allocation Matrix
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fulfillment comparison across food, water, medicine, blankets, and emergency kits.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase text-[10px]">
              <th className="pb-3">Affected Location</th>
              <th className="pb-3">Severity</th>
              <th className="pb-3">🥖 Food</th>
              <th className="pb-3">💧 Water</th>
              <th className="pb-3">💊 Medicine</th>
              <th className="pb-3">🧣 Blankets</th>
              <th className="pb-3">🧰 Emergency Kits</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {affectedAreas.map((area) => {
              // Find delivered totals across all truck stops for this area
              let delFood = 0;
              let delWater = 0;
              let delMed = 0;
              let delBlanket = 0;
              let delKit = 0;

              plan.truck_plans.forEach((tp) => {
                tp.stops_detail.forEach((sd) => {
                  if (sd.location_id === area.id) {
                    delFood += sd.delivered.food;
                    delWater += sd.delivered.water;
                    delMed += sd.delivered.medicine;
                    delBlanket += sd.delivered.blankets;
                    delKit += sd.delivered.emergency_kits;
                  }
                });
              });

              const isFullyServed =
                delFood >= area.food_demand &&
                delWater >= area.water_demand &&
                delMed >= area.medicine_demand &&
                delBlanket >= area.blanket_demand &&
                delKit >= area.emergency_kit_demand;

              const isPartiallyServed =
                delFood > 0 || delWater > 0 || delMed > 0 || delBlanket > 0 || delKit > 0;

              return (
                <tr key={area.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                    {area.name}
                  </td>
                  <td className="py-3">
                    <SeverityBadge severity={area.severity} />
                  </td>
                  <td className="py-3 font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{delFood}</span>
                    <span className="text-slate-400"> / {area.food_demand}</span>
                  </td>
                  <td className="py-3 font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{delWater}</span>
                    <span className="text-slate-400"> / {area.water_demand}</span>
                  </td>
                  <td className="py-3 font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{delMed}</span>
                    <span className="text-slate-400"> / {area.medicine_demand}</span>
                  </td>
                  <td className="py-3 font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{delBlanket}</span>
                    <span className="text-slate-400"> / {area.blanket_demand}</span>
                  </td>
                  <td className="py-3 font-mono">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{delKit}</span>
                    <span className="text-slate-400"> / {area.emergency_kit_demand}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isFullyServed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isPartiallyServed
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {isFullyServed ? 'Fully Met' : isPartiallyServed ? 'Partial' : 'Unreached'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
