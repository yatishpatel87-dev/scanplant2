import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, Calendar, Droplets, Clock, 
  Sparkles, CheckCircle2, ChevronDown, ChevronUp, Info, Sprout
} from 'lucide-react';
import { getCropGrowthPlan } from '../data/cropGrowthData';
import { CropGrowthPlan } from '../types/plant';

interface CropGrowthChartProps {
  cropName: string;
  sowingDate: string;
  compact?: boolean;
}

interface GrowthDataPoint {
  day: number;
  dateStr: string;
  growthPct: number;
  waterDemandPct: number;
  stageName: string;
  stageIcon: string;
  stageDesc: string;
  isCurrentDay?: boolean;
  isMilestone?: boolean;
}

export const CropGrowthChart: React.FC<CropGrowthChartProps> = ({
  cropName,
  sowingDate,
  compact = false
}) => {
  const [viewMetric, setViewMetric] = useState<'both' | 'growth' | 'water'>('both');
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  const plan: CropGrowthPlan = useMemo(() => {
    return getCropGrowthPlan(cropName || 'કપાસ');
  }, [cropName]);

  // Calculate days elapsed from sowing date
  const { daysElapsed, plantingDate, harvestDate, chartData, currentStage, currentProgressPct } = useMemo(() => {
    const today = new Date();
    const planting = new Date(sowingDate || '2026-06-15');
    
    let elapsed = 45;
    if (!isNaN(planting.getTime())) {
      const diffTime = today.getTime() - planting.getTime();
      elapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }

    const totalDays = plan.total_days || 150;
    const clampedElapsed = Math.min(elapsed, totalDays);

    const harvest = new Date(planting);
    harvest.setDate(harvest.getDate() + totalDays);

    // Find current active stage
    const activeStage = plan.stages.find(
      s => elapsed >= s.start_day && elapsed <= s.end_day
    ) || (elapsed > totalDays ? plan.stages[plan.stages.length - 1] : plan.stages[0]);

    // Generate Sigmoid Growth Curve and Water Demand Curve points
    const step = Math.max(5, Math.round(totalDays / 20));
    const points: GrowthDataPoint[] = [];

    // Collect key milestone days
    const milestoneDays = new Set<number>([0, totalDays]);
    plan.stages.forEach(s => {
      milestoneDays.add(s.start_day);
      milestoneDays.add(s.end_day);
    });
    milestoneDays.add(clampedElapsed);

    const sortedDays = Array.from(milestoneDays).sort((a, b) => a - b);

    // Fill in intermediate points for a smooth curve
    const allDays: number[] = [];
    for (let d = 0; d <= totalDays; d += step) {
      allDays.push(d);
    }
    sortedDays.forEach(d => {
      if (!allDays.includes(d)) {
        allDays.push(d);
      }
    });
    allDays.sort((a, b) => a - b);

    // Remove duplicates
    const uniqueDays = Array.from(new Set(allDays));

    uniqueDays.forEach(d => {
      const pDate = new Date(planting);
      pDate.setDate(pDate.getDate() + d);

      const stageForDay = plan.stages.find(s => d >= s.start_day && d <= s.end_day) || plan.stages[plan.stages.length - 1];

      // Sigmoid Logistic Growth formula: L / (1 + e^(-k*(x - x0)))
      // Normalized from 0% at day 0 to 100% at totalDays
      const midPoint = totalDays * 0.48;
      const k = 10 / totalDays;
      const rawSigmoid = 1 / (1 + Math.exp(-k * (d - midPoint)));
      const base0 = 1 / (1 + Math.exp(-k * (0 - midPoint)));
      const base100 = 1 / (1 + Math.exp(-k * (totalDays - midPoint)));
      const normalizedGrowth = Math.max(0, Math.min(100, Math.round(((rawSigmoid - base0) / (base100 - base0)) * 100)));

      // Water demand bell curve: low at start (20%), peaks during flowering/fruiting (85-95%), drops at maturity (25%)
      const flowerMid = totalDays * 0.52;
      const bellDist = Math.abs(d - flowerMid) / (totalDays * 0.45);
      const waterDemand = Math.max(20, Math.min(95, Math.round(95 * Math.exp(-1.8 * (bellDist * bellDist)))));

      points.push({
        day: d,
        dateStr: pDate.toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' }),
        growthPct: normalizedGrowth,
        waterDemandPct: waterDemand,
        stageName: stageForDay ? stageForDay.name_gu : '',
        stageIcon: stageForDay ? stageForDay.icon : '🌱',
        stageDesc: stageForDay ? stageForDay.description_gu : '',
        isCurrentDay: d === clampedElapsed,
        isMilestone: milestoneDays.has(d)
      });
    });

    // Current estimated progress
    const curPt = points.find(p => p.day === clampedElapsed);
    const progressPct = curPt ? curPt.growthPct : Math.min(100, Math.round((clampedElapsed / totalDays) * 100));

    return {
      daysElapsed: elapsed,
      plantingDate: planting,
      harvestDate: harvest,
      chartData: points,
      currentStage: activeStage,
      currentProgressPct: progressPct
    };
  }, [plan, sowingDate]);

  const daysRemaining = Math.max(0, (plan.total_days || 150) - daysElapsed);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg shadow-sm">
            <TrendingUp className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                પાક વૃદ્ધિ ગ્રાફ વિશ્લેષણ
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-medium">
                {plan.crop_name_gu}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              અંદાજિત પાક વિકાસ અને સિંચાઈ માંગ ચક્ર
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Metric Selector Buttons */}
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-xs">
            <button
              onClick={() => setViewMetric('both')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMetric === 'both' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              બંને
            </button>
            <button
              onClick={() => setViewMetric('growth')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMetric === 'growth' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              વિકાસ %
            </button>
            <button
              onClick={() => setViewMetric('water')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMetric === 'water' ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              પાણી માંગ %
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-colors"
            title={isExpanded ? 'ટૂંકમાં કરો' : 'મોટું કરો'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>પાકની ઉંમર</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
            {daysElapsed}મો દિવસ
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            કુલ {plan.total_days} દિવસમાંથી
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>વિકાસ ટકાવારી</span>
          </div>
          <div className="text-base sm:text-lg font-black text-blue-950 mt-0.5">
            {currentProgressPct}% પરિપક્વ
          </div>
          <div className="text-[10px] text-blue-700/80 truncate">
            સિગ્મોઇડ વૃદ્ધિ મોડેલ
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
            <Sprout className="w-3.5 h-3.5 text-amber-600" />
            <span>હાલનો તબક્કો</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate flex items-center gap-1">
            <span>{currentStage.icon}</span>
            <span className="truncate">{currentStage.name_gu}</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {currentStage.start_day} થી {currentStage.end_day}મો દિવસ
          </div>
        </div>

        <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-semibold text-purple-900 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>લણણી અંદાજ</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-purple-950 mt-0.5 truncate">
            {harvestDate.toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' })}
          </div>
          <div className="text-[10px] text-purple-700 truncate">
            {daysRemaining > 0 ? `${daysRemaining} દિવસ બાકી` : 'કાપણી પૂર્ણ'}
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization */}
      {isExpanded && (
        <div className="pt-2">
          {/* Chart Subtitle & Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mb-2 gap-2">
            <div className="flex items-center gap-4">
              {(viewMetric === 'both' || viewMetric === 'growth') && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                  <span className="font-semibold text-slate-700">પાક વૃદ્ધિ અને પરિપક્વતા % (Growth Index)</span>
                </div>
              )}
              {(viewMetric === 'both' || viewMetric === 'water') && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-blue-500 inline-block border-t border-dashed"></span>
                  <span className="font-semibold text-blue-700">પાણી/સિંચાઈ માંગ % (Water Demand)</span>
                </div>
              )}
            </div>

            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
              📍 લાલ ઊભી લાઇન = આજનો દિવસ ({daysElapsed}મો દિવસ)
            </span>
          </div>

          {/* Recharts Container */}
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -18, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val} દિ`}
                />

                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${val}%`}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as GrowthDataPoint;
                      return (
                        <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs backdrop-blur-md max-w-xs animate-fade-in">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5 mb-1.5">
                            <span className="font-bold text-amber-300 flex items-center gap-1 text-sm">
                              <span>{data.stageIcon}</span>
                              <span>{data.stageName}</span>
                            </span>
                            <span className="text-[11px] text-slate-300 font-mono">
                              {data.dateStr} (દિવસ {data.day})
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-300 font-medium">પાક વિકાસ:</span>
                              <span className="font-bold text-emerald-200">{data.growthPct}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-blue-300 font-medium">સિંચાઈ માંગ:</span>
                              <span className="font-bold text-blue-200">{data.waterDemandPct}%</span>
                            </div>
                          </div>

                          {data.stageDesc && (
                            <p className="text-[11px] text-slate-300/90 mt-2 pt-1.5 border-t border-slate-800 leading-relaxed">
                              {data.stageDesc}
                            </p>
                          )}

                          {data.day === daysElapsed && (
                            <div className="mt-1.5 bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded text-[10px] font-bold text-center border border-amber-500/40">
                              👉 આજની સ્થિતિ
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Reference line for current day */}
                <ReferenceLine
                  x={Math.min(daysElapsed, plan.total_days)}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: `આજે (${daysElapsed} દિ)`,
                    position: 'top',
                    fill: '#b91c1c',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                />

                {/* Water Demand Area / Line */}
                {(viewMetric === 'both' || viewMetric === 'water') && (
                  <Area
                    type="monotone"
                    dataKey="waterDemandPct"
                    name="સિંચાઈ માંગ %"
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    fillOpacity={1}
                    fill="url(#waterGradient)"
                  />
                )}

                {/* Growth Curve Area / Line */}
                {(viewMetric === 'both' || viewMetric === 'growth') && (
                  <Area
                    type="monotone"
                    dataKey="growthPct"
                    name="પાક વિકાસ %"
                    stroke="#059669"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#growthGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Milestones Bar Below Chart */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-700 block mb-2">
              પાક વિકાસ ચક્રના મુખ્ય તબક્કા અને લક્ષ્યાંક તારીખો:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {plan.stages.map((stg) => {
                const sDate = new Date(plantingDate);
                sDate.setDate(sDate.getDate() + stg.start_day);
                const isPassed = daysElapsed > stg.end_day;
                const isCurrent = daysElapsed >= stg.start_day && daysElapsed <= stg.end_day;

                return (
                  <div
                    key={stg.id}
                    className={`p-2 rounded-xl border text-xs transition-colors ${
                      isCurrent
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40'
                        : isPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold truncate text-[11px] text-slate-900">
                        {stg.icon} {stg.name_gu}
                      </span>
                      {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex justify-between items-center">
                      <span>{stg.start_day}-{stg.end_day} દિવસ</span>
                      <span className="font-semibold text-emerald-800">
                        {sDate.toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Explanatory Footnote */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>આ ગ્રાફ પાકની વાવણી તારીખ ({new Date(sowingDate).toLocaleDateString('gu-IN')}) અને કૃષિ યુનિવર્સિટીના બાયોમાસ મોડેલ પર આધારિત છે.</span>
        </div>
      </div>
    </div>
  );
};
