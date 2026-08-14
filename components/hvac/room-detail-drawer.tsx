'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Thermometer,
  Users,
  Wind,
  Clock,
  Calendar,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import type { Room } from '@/lib/hvac-types';
import { useHVACStore } from '@/lib/hvac-store';
import { roomTypeLabels } from '@/lib/hvac-mock-data';
import { cn } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/chart-colors';

interface RoomDetailDrawerProps {
  room: Room | undefined;
  open: boolean;
  onClose: () => void;
}

export function RoomDetailDrawer({ room, open, onClose }: RoomDetailDrawerProps) {
  const { coolingUnits, dampers, schedules, issues, recommendations } = useHVACStore();

  if (!room) return null;

  const unit = coolingUnits.find(u => u.id === room.assignedCoolingUnit);
  const damper = dampers.find(d => d.id === room.connectedDamper);
  const roomSchedules = schedules.filter(s => s.roomId === room.id);
  const roomIssues = issues.filter(i => i.relatedComponent.id === room.id && i.status === 'open');
  const roomRecommendations = recommendations.filter(r => r.roomId === room.id);

  const tempHistory = room.temperatureHistory.slice(-24).map(p => ({
    time: new Date(p.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    value: p.value,
    target: room.targetTemp,
  }));

  const tempDelta = room.currentTemp - room.targetTemp;
  const tempTrend = tempDelta > 0 ? 'rising' : tempDelta < 0 ? 'falling' : 'stable';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-xl">{room.name}</SheetTitle>
            <Badge variant="outline" className="text-xs">
              {roomTypeLabels[room.roomType]}
            </Badge>
          </div>
          <SheetDescription className="flex items-center gap-2 text-xs">
            Connected to {unit?.name ?? 'N/A'} via {damper?.name ?? 'N/A'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Temperature Section */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground">Temperature</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Current</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">{room.currentTemp}°C</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-accent" />
                  <span className="text-xs text-muted-foreground">Target</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">{room.targetTemp}°C</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  {tempTrend === 'rising' ? (
                    <TrendingUp className="h-4 w-4 text-destructive" />
                  ) : tempTrend === 'falling' ? (
                    <TrendingDown className="h-4 w-4 text-accent" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">Predicted</span>
                </div>
                <p className="mt-1 text-xl font-bold text-foreground">{room.predictedTemp}°C</p>
              </div>
            </div>

            {/* Temperature History Sparkline */}
            <div className="mt-4 h-24 rounded-lg border border-border bg-card/50 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tempHistory}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 1', 'dataMax + 1']}
                    hide
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded border border-border bg-card p-2 text-xs">
                          <p>{payload[0].payload.time}</p>
                          <p className="font-medium">{payload[0].value}°C</p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={1.5}
                    fill="url(#tempGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <Separator />

          {/* Occupancy & Comfort */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground">Occupancy & Comfort</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Occupancy</span>
                  </div>
                  <span className="text-sm font-medium">{room.occupancyCount} / {room.capacity}</span>
                </div>
                <Progress value={(room.occupancyCount / room.capacity) * 100} className="h-2" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Comfort Score</span>
                  <span className={cn(
                    'text-sm font-medium',
                    room.comfortScore >= 80 ? 'text-accent' : 
                    room.comfortScore >= 60 ? 'text-foreground' : 'text-warning'
                  )}>
                    {room.comfortScore}%
                  </span>
                </div>
                <Progress 
                  value={room.comfortScore} 
                  className={cn(
                    'h-2',
                    room.comfortScore >= 80 ? '[&>div]:bg-accent' :
                    room.comfortScore >= 60 ? '[&>div]:bg-primary' : '[&>div]:bg-warning'
                  )}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Airflow */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground">Airflow</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Damper</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{damper?.openness ?? 0}%</p>
                <p className="text-xs text-muted-foreground">{damper?.name}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Wind className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Airflow</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{room.airflowEstimate}</p>
                <p className="text-xs text-muted-foreground">CFM estimate</p>
              </div>
            </div>
          </section>

          {/* Schedules */}
          {roomSchedules.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Calendar className="h-4 w-4" />
                  Active Schedules
                </h3>
                <div className="space-y-2">
                  {roomSchedules.map(schedule => (
                    <div 
                      key={schedule.id}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {schedule.scheduleType === 'permanent' ? 'Recurring' : 'Temporary'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {schedule.targetTemp}°C target
                        </span>
                      </div>
                      <p className="mt-2 text-sm">
                        {schedule.activeTimes.start} - {schedule.activeTimes.end}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Issues */}
          {roomIssues.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Open Issues ({roomIssues.length})
                </h3>
                <div className="space-y-2">
                  {roomIssues.map(issue => (
                    <div 
                      key={issue.id}
                      className={cn(
                        'rounded-lg border p-3',
                        issue.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                        issue.severity === 'warning' ? 'border-warning/30 bg-warning/5' :
                        'border-border bg-card'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">{issue.title}</p>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-[10px]',
                            issue.severity === 'critical' ? 'border-destructive text-destructive' :
                            issue.severity === 'warning' ? 'border-warning text-warning' :
                            'border-primary text-primary'
                          )}
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Recommendations */}
          {roomRecommendations.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  AI Recommendations
                </h3>
                <div className="space-y-2">
                  {roomRecommendations.map(rec => (
                    <div
                      key={rec.id}
                      className="rounded-lg border border-primary/20 bg-primary/5 p-3"
                    >
                      <p className="text-sm font-medium capitalize">{rec.action.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{rec.reason}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={cn('text-xs', rec.estimatedEnergyChange < 0 ? 'text-success' : 'text-muted-foreground')}>
                          {rec.estimatedEnergyChange >= 0 ? '+' : ''}
                          {rec.estimatedEnergyChange.toFixed(3)} kWh
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {rec.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
