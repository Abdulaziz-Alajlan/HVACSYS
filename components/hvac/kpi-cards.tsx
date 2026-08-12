'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  Leaf, 
  Smile, 
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHVACStore } from '@/lib/hvac-store';
import { cn } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  icon: React.ReactNode;
  sparklineData?: number[];
  variant?: 'default' | 'success' | 'warning' | 'critical';
  tooltip?: string;
}

function KPICard({ 
  title, 
  value, 
  unit,
  trend,
  trendValue,
  description,
  icon,
  sparklineData,
  variant = 'default',
  tooltip,
}: KPICardProps) {
  const variantStyles = {
    default: 'border-border/50',
    success: 'border-accent/30 glow-accent',
    warning: 'border-warning/30 glow-warning',
    critical: 'border-destructive/30 glow-critical',
  };

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    critical: 'bg-destructive/10 text-destructive',
  };

  const sparklineColors = {
    default: { stroke: 'hsl(220 80% 65%)', fill: 'hsl(220 80% 65% / 0.2)' },
    success: { stroke: 'hsl(165 80% 55%)', fill: 'hsl(165 80% 55% / 0.2)' },
    warning: { stroke: 'hsl(45 90% 55%)', fill: 'hsl(45 90% 55% / 0.2)' },
    critical: { stroke: 'hsl(0 80% 55%)', fill: 'hsl(0 80% 55% / 0.2)' },
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-accent' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  const content = (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-300 hover:border-primary/50',
      variantStyles[variant]
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {value}
              </span>
              {unit && (
                <span className="text-sm font-medium text-muted-foreground">{unit}</span>
              )}
            </div>
            {(trend || description) && (
              <div className="mt-1 flex items-center gap-2">
                {trend && trendValue && (
                  <div className={cn('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span>{trendValue}</span>
                  </div>
                )}
                {description && (
                  <span className="text-xs text-muted-foreground">{description}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconStyles[variant])}>
            {icon}
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData.map((v, i) => ({ value: v, index: i }))}>
                <defs>
                  <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColors[variant].fill} />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColors[variant].stroke}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title.replace(/\s/g, '')})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function KPICards() {
  const { kpis, utilizationHistory, rooms, issues, aiOptimizationActive } = useHVACStore();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering time-based values on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get last N utilization values for sparkline
  const utilizationSparkline = utilizationHistory.slice(-20).map(p => p.utilization);
  const efficiencySparkline = utilizationHistory.slice(-20).map(p => p.efficiency);
  
  // Calculate comfort trend
  const avgComfort = rooms.reduce((sum, r) => sum + r.comfortScore, 0) / (rooms.length || 1);
  const comfortTrend = avgComfort > 75 ? 'up' : avgComfort < 60 ? 'down' : 'neutral';
  
  // Format peak time - only on client to avoid hydration mismatch
  const peakTime = kpis.predictedPeakDemandTime;
  const peakTimeStr = mounted && peakTime 
    ? `${peakTime.getHours()}:${String(peakTime.getMinutes()).padStart(2, '0')}` 
    : '--:--';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <KPICard
        title="Active Rooms"
        value={kpis.totalActiveRooms}
        unit={`/ ${kpis.totalRooms}`}
        trend="neutral"
        description="Currently cooling"
        icon={<Activity className="h-5 w-5" />}
        tooltip={`${kpis.totalActiveRooms} rooms are actively being cooled out of ${kpis.totalRooms} total rooms in the system`}
      />

      <KPICard
        title="Cooling Load"
        value={kpis.coolingLoadPercentage}
        unit="%"
        trend={kpis.coolingLoadPercentage > 85 ? 'up' : 'neutral'}
        trendValue={kpis.coolingLoadPercentage > 85 ? 'High' : 'Normal'}
        icon={<Zap className="h-5 w-5" />}
        sparklineData={utilizationSparkline}
        variant={kpis.coolingLoadPercentage > 90 ? 'warning' : 'default'}
        tooltip="Average load across all cooling units based on current demand"
      />

      <KPICard
        title="Energy Savings"
        value={kpis.estimatedEnergySavings}
        unit="kWh"
        description={aiOptimizationActive ? 'vs. baseline, next 30 min' : 'AI optimization disabled'}
        icon={<Leaf className="h-5 w-5" />}
        variant={aiOptimizationActive && kpis.estimatedEnergySavings > 0 ? 'success' : 'default'}
        tooltip={
          aiOptimizationActive
            ? 'Estimated energy saved over the next 30 minutes if all current AI recommendations were applied, vs. leaving dampers unchanged'
            : 'AI optimization is off, so no recommendations are being generated — turn it on to see estimated savings vs. baseline'
        }
      />

      <KPICard
        title="Comfort Score"
        value={Math.round(avgComfort)}
        unit="%"
        trend={comfortTrend}
        trendValue={comfortTrend === 'up' ? 'Good' : comfortTrend === 'down' ? 'Low' : 'Stable'}
        icon={<Smile className="h-5 w-5" />}
        sparklineData={rooms.map(r => r.comfortScore)}
        variant={avgComfort > 75 ? 'success' : avgComfort < 60 ? 'warning' : 'default'}
        tooltip="Average comfort score across all rooms based on temperature deviation and occupancy"
      />

      <KPICard
        title="Open Issues"
        value={kpis.openIssuesCount}
        trend={kpis.openIssuesCount > 3 ? 'up' : 'neutral'}
        trendValue={kpis.openIssuesCount > 3 ? 'Attention' : ''}
        description="Needs attention"
        icon={<AlertTriangle className="h-5 w-5" />}
        variant={kpis.openIssuesCount > 5 ? 'critical' : kpis.openIssuesCount > 2 ? 'warning' : 'default'}
        tooltip={`${issues.filter(i => i.severity === 'critical').length} critical, ${issues.filter(i => i.severity === 'warning').length} warnings, ${issues.filter(i => i.severity === 'info').length} info`}
      />

      <KPICard
        title="Peak Demand"
        value={peakTimeStr}
        description="Predicted today"
        icon={<Clock className="h-5 w-5" />}
        tooltip="AI-predicted peak cooling demand time based on historical patterns and scheduled occupancy"
      />
    </div>
  );
}
