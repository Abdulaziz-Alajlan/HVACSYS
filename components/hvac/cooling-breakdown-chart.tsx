'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useHVACStore } from '@/lib/hvac-store';
import { roomTypeLabels } from '@/lib/hvac-mock-data';
import { CHART_PALETTE as COLORS } from '@/lib/chart-colors';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
      currentTemp: number;
      targetTemp: number;
      occupancy: number;
      capacity: number;
      unit: string;
      roomType: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="mb-2 font-medium text-foreground">{data.name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cooling Share</span>
          <span className="font-medium text-foreground">{data.value.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Current Temp</span>
          <span className="font-medium text-foreground">{data.currentTemp}°C</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Target Temp</span>
          <span className="font-medium text-foreground">{data.targetTemp}°C</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Occupancy</span>
          <span className="font-medium text-foreground">{data.occupancy}/{data.capacity}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium text-foreground">{data.roomType}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Assigned Unit</span>
          <span className="font-medium text-foreground">{data.unit}</span>
        </div>
      </div>
    </div>
  );
}

export function CoolingBreakdownChart() {
  const { rooms, coolingUnits, setHighlightedRoom } = useHVACStore();

  const chartData = useMemo(() => {
    const activeRooms = rooms.filter(r => r.coolingStatus !== 'Inactive Cooling');
    const totalAirflow = activeRooms.reduce((sum, r) => sum + r.airflowEstimate, 0);
    
    return activeRooms.map(room => {
      const unit = coolingUnits.find(u => u.id === room.assignedCoolingUnit);
      return {
        id: room.id,
        name: room.name,
        value: totalAirflow > 0 ? (room.airflowEstimate / totalAirflow) * 100 : 0,
        currentTemp: room.currentTemp,
        targetTemp: room.targetTemp,
        occupancy: room.occupancyCount,
        capacity: room.capacity,
        unit: unit?.name ?? 'N/A',
        roomType: roomTypeLabels[room.roomType],
      };
    }).sort((a, b) => b.value - a.value);
  }, [rooms, coolingUnits]);

  const topConsumer = chartData[0];
  const totalActiveShare = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="col-span-2 min-w-0 lg:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Cooling Usage Breakdown
        </CardTitle>
        <CardDescription className="text-xs">
          Distribution by room (active rooms only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => {
                  setHighlightedRoom(chartData[index].id);
                }}
                onMouseLeave={() => {
                  setHighlightedRoom(null);
                }}
                onClick={(_, index) => {
                  setHighlightedRoom(chartData[index].id);
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {chartData.length}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Top Consumer</p>
            <p className="text-sm font-medium text-foreground">
              {topConsumer?.name ?? 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              {topConsumer?.value.toFixed(1)}% of active cooling
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Active Share</p>
            <p className="text-sm font-medium text-foreground">
              {chartData.length} / {rooms.length} rooms
            </p>
            <p className="text-xs text-muted-foreground">
              {((chartData.length / rooms.length) * 100).toFixed(0)}% of building
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
