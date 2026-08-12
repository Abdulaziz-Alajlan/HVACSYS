'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHVACStore } from '@/lib/hvac-store';
import { cn } from '@/lib/utils';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  activeZones?: number;
}

function CustomTooltip({ active, payload, label, activeZones }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="h-2.5 w-2.5 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-border pt-2">
        <p className="text-xs text-muted-foreground">
          Active zones: {activeZones ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground">
          Est. power: {Math.floor(payload[0]?.value * 1.2 + 10)} kW
        </p>
      </div>
    </div>
  );
}

export function UtilizationChart() {
  const { utilizationHistory, coolingUnits, timeRange, setTimeRange, kpis } = useHVACStore();
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const chartData = useMemo(() => {
    let dataPoints = utilizationHistory;
    
    // Filter by time range
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    
    dataPoints = dataPoints.filter(
      p => now - new Date(p.time).getTime() < ranges[timeRange]
    );

    return dataPoints.map(point => ({
      time: new Date(point.time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      utilization: point.utilization,
      efficiency: point.efficiency,
      powerUsage: point.powerUsage,
    }));
  }, [utilizationHistory, timeRange, selectedUnit]);

  // Find peak demand point
  const peakPoint = chartData.reduce((max, point) => 
    point.utilization > (max?.utilization ?? 0) ? point : max
  , chartData[0]);

  return (
    <Card className="col-span-2 lg:col-span-1">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Cooling Unit Utilization
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            System load and efficiency over time
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {coolingUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-border">
            {(['1h', '24h', '7d'] as const).map(range => (
              <Button
                key={range}
                variant="ghost"
                size="sm"
                onClick={() => setTimeRange(range)}
                className={cn(
                  'h-8 rounded-none px-3 text-xs first:rounded-l-md last:rounded-r-md',
                  timeRange === range && 'bg-secondary'
                )}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {peakPoint && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Peak detected at {peakPoint.time}: {peakPoint.utilization.toFixed(0)}%
            </Badge>
          </div>
        )}
        
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220 80% 65%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(220 80% 65%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(165 80% 55%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(165 80% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.4}
                vertical={false}
              />
              <XAxis 
                dataKey="time" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip activeZones={kpis.totalActiveRooms} />} />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <ReferenceLine 
                y={85} 
                stroke="hsl(var(--warning))" 
                strokeDasharray="5 5"
                opacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="utilization"
                name="Utilization"
                stroke="hsl(220 80% 65%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(220 80% 65%)' }}
              />
              <Line
                type="monotone"
                dataKey="efficiency"
                name="Efficiency"
                stroke="hsl(165 80% 55%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(165 80% 55%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
