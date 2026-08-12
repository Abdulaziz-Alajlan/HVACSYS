'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  TrendingUp,
  Zap,
  Thermometer,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useHVACStore } from '@/lib/hvac-store';
import { cn } from '@/lib/utils';

export function AIInsightsCard() {
  const { rooms, coolingUnits, kpis, utilizationHistory, aiOptimizationActive } = useHVACStore();

  // Calculate insights
  const avgUtilization = utilizationHistory.slice(-12).reduce((sum, p) => sum + p.utilization, 0) / 12;
  const peakHour = kpis.predictedPeakDemandTime.getHours();
  const roomsAtRisk = rooms.filter(r => r.comfortScore < 60).length;
  const highLoadUnits = coolingUnits.filter(u => u.load > 85).length;
  const lowEffUnits = coolingUnits.filter(u => u.efficiency < 80).length;
  
  // Calculate suggested pre-cool window
  const preCoolStart = peakHour - 2;
  const preCoolWindow = `${String(preCoolStart).padStart(2, '0')}:00 - ${String(peakHour).padStart(2, '0')}:00`;

  // Demand trend: from the backend's 30-min-ahead predictions vs current draw
  const nextHourDemand = kpis.demandTrend;

  return (
    <Card className={cn(
      'relative overflow-hidden',
      aiOptimizationActive && 'glow-primary'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className={cn(
                'h-4 w-4',
                aiOptimizationActive && 'animate-pulse text-primary'
              )} />
              AI Insights
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Predictive analytics and optimization
            </CardDescription>
          </div>
          <Badge 
            variant={aiOptimizationActive ? 'default' : 'outline'}
            className="text-[10px]"
          >
            {aiOptimizationActive ? 'Active' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Demand Forecast */}
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className={cn(
                'h-4 w-4',
                nextHourDemand === 'increasing' ? 'text-warning' :
                nextHourDemand === 'decreasing' ? 'text-accent' : 'text-muted-foreground'
              )} />
              <span className="text-sm font-medium">Demand Forecast</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                'text-[10px]',
                nextHourDemand === 'increasing' ? 'border-warning text-warning' :
                nextHourDemand === 'decreasing' ? 'border-accent text-accent' : ''
              )}
            >
              {nextHourDemand === 'increasing' ? 'Rising' :
               nextHourDemand === 'decreasing' ? 'Falling' : 'Low'}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {nextHourDemand === 'increasing' 
              ? 'Expect peak demand approaching. Consider pre-cooling priority rooms.'
              : nextHourDemand === 'decreasing'
              ? 'Demand declining. Opportunity to reduce cooling intensity.'
              : 'Low demand period. Minimal cooling required.'}
          </p>
        </div>

        {/* Peak Load Window */}
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Peak Load Window</span>
            </div>
            <span className="text-sm font-mono text-foreground">{String(peakHour).padStart(2, '0')}:00</span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pre-cool window</span>
              <span className="font-medium">{preCoolWindow}</span>
            </div>
            <Progress 
              value={avgUtilization} 
              className="mt-2 h-1.5"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Current avg. utilization: {avgUtilization.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Risk Factors
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(
              'rounded-lg border p-2',
              roomsAtRisk > 0 ? 'border-warning/30 bg-warning/5' : 'border-border'
            )}>
              <div className="flex items-center gap-1.5">
                <Thermometer className={cn(
                  'h-3.5 w-3.5',
                  roomsAtRisk > 0 ? 'text-warning' : 'text-muted-foreground'
                )} />
                <span className="text-xs text-muted-foreground">Comfort Risk</span>
              </div>
              <p className="mt-1 text-lg font-bold">
                {roomsAtRisk}
                <span className="ml-1 text-xs font-normal text-muted-foreground">rooms</span>
              </p>
            </div>
            <div className={cn(
              'rounded-lg border p-2',
              highLoadUnits > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border'
            )}>
              <div className="flex items-center gap-1.5">
                <Zap className={cn(
                  'h-3.5 w-3.5',
                  highLoadUnits > 0 ? 'text-destructive' : 'text-muted-foreground'
                )} />
                <span className="text-xs text-muted-foreground">High Load</span>
              </div>
              <p className="mt-1 text-lg font-bold">
                {highLoadUnits}
                <span className="ml-1 text-xs font-normal text-muted-foreground">units</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Suggestions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick Suggestions
          </p>
          <div className="space-y-1.5">
            {roomsAtRisk > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs">
                <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                <span>{roomsAtRisk} room(s) need comfort intervention</span>
              </div>
            )}
            {lowEffUnits > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1.5 text-xs">
                <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                <span>{lowEffUnits} unit(s) showing efficiency degradation</span>
              </div>
            )}
            {nextHourDemand === 'increasing' && (
              <div className="flex items-center gap-2 rounded-md bg-accent/10 px-2 py-1.5 text-xs">
                <TrendingUp className="h-3 w-3 shrink-0 text-accent" />
                <span>Pre-cool high-priority rooms before {peakHour}:00</span>
              </div>
            )}
            {roomsAtRisk === 0 && lowEffUnits === 0 && nextHourDemand !== 'increasing' && (
              <div className="flex items-center gap-2 rounded-md bg-accent/10 px-2 py-1.5 text-xs">
                <Sparkles className="h-3 w-3 shrink-0 text-accent" />
                <span>System operating optimally</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
