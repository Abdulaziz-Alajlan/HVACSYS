'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  Lightbulb,
  Check,
  Clock,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useHVACStore } from '@/lib/hvac-store';
import type { Issue, MaintenanceEvent, LiveRecommendation } from '@/lib/hvac-types';
import { cn } from '@/lib/utils';
import { RelativeTime } from './relative-time';
import { toast } from 'sonner';

const severityConfig = {
  critical: { icon: AlertTriangle, className: 'text-destructive', bgClassName: 'bg-destructive/10' },
  warning: { icon: AlertCircle, className: 'text-warning', bgClassName: 'bg-warning/10' },
  info: { icon: Info, className: 'text-primary', bgClassName: 'bg-primary/10' },
};

function IssueItem({ issue, onAcknowledge, onResolve }: { 
  issue: Issue; 
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={cn(
      'group rounded-lg border p-3 transition-colors hover:border-primary/30',
      issue.status === 'resolved' ? 'opacity-60' : '',
      issue.severity === 'critical' ? 'border-destructive/30' :
      issue.severity === 'warning' ? 'border-warning/30' : 'border-border'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-md p-1.5', config.bgClassName)}>
          <Icon className={cn('h-3.5 w-3.5', config.className)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight text-foreground">{issue.title}</p>
            <Badge 
              variant="outline" 
              className={cn(
                'shrink-0 text-[10px]',
                issue.status === 'resolved' ? 'border-accent text-accent' :
                issue.status === 'acknowledged' ? 'border-primary text-primary' :
                config.className
              )}
            >
              {issue.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{issue.description}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="shrink-0"><RelativeTime date={issue.timestamp} /></span>
            <span className="text-border">|</span>
            <span className="truncate">{issue.source}</span>
          </div>
          {issue.status === 'open' && (
            <div className="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onAcknowledge}
              >
                Acknowledge
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onResolve}
              >
                Resolve
              </Button>
            </div>
          )}
          {issue.suggestedAction && issue.status === 'open' && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3 shrink-0 text-primary" />
              <span>{issue.suggestedAction}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MaintenanceItem({ event }: { event: MaintenanceEvent }) {
  const eventDate = new Date(event.date);
  const isOverdue = event.status === 'overdue';
  const isPast = eventDate < new Date();

  return (
    <div className={cn(
      'rounded-lg border p-3',
      isOverdue ? 'border-destructive/30' : 'border-border'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 rounded-md p-1.5',
          isOverdue ? 'bg-destructive/10' : 'bg-muted'
        )}>
          <Wrench className={cn('h-3.5 w-3.5', isOverdue ? 'text-destructive' : 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight text-foreground">{event.title}</p>
            <Badge 
              variant="outline" 
              className={cn(
                'shrink-0 text-[10px]',
                event.status === 'completed' ? 'border-accent text-accent' :
                event.status === 'overdue' ? 'border-destructive text-destructive' :
                event.status === 'in-progress' ? 'border-primary text-primary' :
                'border-muted-foreground'
              )}
            >
              {event.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {isPast && event.status !== 'completed' ? 'Was scheduled for ' : 'Scheduled for '}
              {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
            </span>
            <span className="text-border">|</span>
            <span>{event.componentType}: {event.componentId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const recommendationActionConfig: Record<string, { icon: typeof Sparkles; className: string; label: string }> = {
  increase_airflow: { icon: TrendingUp, className: 'text-warning', label: 'Increase airflow' },
  decrease_airflow: { icon: TrendingDown, className: 'text-accent', label: 'Decrease airflow' },
  maintain: { icon: Sparkles, className: 'text-primary', label: 'Maintain' },
};

function RecommendationItem({ rec, onApply }: { rec: LiveRecommendation; onApply: () => void }) {
  const config = recommendationActionConfig[rec.action] ?? recommendationActionConfig.maintain;
  const Icon = config.icon;

  return (
    <div className="group rounded-lg border border-primary/20 bg-primary/5 p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5">
          <Icon className={cn('h-3.5 w-3.5', config.className)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-tight text-foreground">
              {config.label} — {rec.zoneName}
            </p>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px] capitalize',
                rec.status === 'applied' ? 'border-accent text-accent' : 'border-primary/30 text-primary'
              )}
            >
              {rec.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{rec.reason}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-xs', rec.estimatedEnergyChange < 0 ? 'text-success' : 'text-muted-foreground')}>
              {rec.estimatedEnergyChange >= 0 ? '+' : ''}
              {rec.estimatedEnergyChange.toFixed(3)} kWh
            </span>
            {rec.isReal && rec.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                onClick={onApply}
              >
                Apply
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssuesPanel() {
  const {
    issues,
    maintenanceEvents,
    recommendations,
    acknowledgeIssue,
    resolveIssue,
    reopenIssue,
    applyRecommendation,
    aiOptimizationActive,
  } = useHVACStore();
  const [activeTab, setActiveTab] = useState('all');

  // Fire-and-forget status changes with no confirm step; "Undo" on the toast
  // is the lower-friction alternative to a confirm dialog for this severity
  // of action (compare to Schedule delete, which does get a confirm dialog).
  const handleAcknowledge = (issue: Issue) => {
    acknowledgeIssue(issue.id);
    toast.success('Issue acknowledged', {
      description: issue.title,
      action: { label: 'Undo', onClick: () => reopenIssue(issue.id) },
    });
  };

  const handleResolve = (issue: Issue) => {
    resolveIssue(issue.id);
    toast.success('Issue resolved', {
      description: issue.title,
      action: { label: 'Undo', onClick: () => reopenIssue(issue.id) },
    });
  };

  const openIssues = issues.filter(i => i.status === 'open');
  const criticalCount = openIssues.filter(i => i.severity === 'critical').length;
  const warningCount = openIssues.filter(i => i.severity === 'warning').length;
  const scheduledMaintenance = maintenanceEvents.filter(e => e.status !== 'completed');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Issues & Maintenance</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {openIssues.length} open issues, {scheduledMaintenance.length} maintenance items
            </CardDescription>
          </div>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {criticalCount} Critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-8 w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="issues" className="text-xs">
              Issues
              {openIssues.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {openIssues.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs">Maint.</TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs">AI</TabsTrigger>
          </TabsList>

          <ScrollArea className="mt-4 h-[340px] pr-4">
            <TabsContent value="all" className="m-0 space-y-3">
              {/* Critical issues first */}
              {openIssues
                .filter(i => i.severity === 'critical')
                .map(issue => (
                  <IssueItem 
                    key={issue.id} 
                    issue={issue}
                    onAcknowledge={() => handleAcknowledge(issue)}
                    onResolve={() => handleResolve(issue)}
                  />
                ))}
              {/* Then recommendations */}
              {recommendations.slice(0, 2).map(rec => (
                <RecommendationItem key={rec.id} rec={rec} onApply={() => applyRecommendation(rec.id)} />
              ))}
              {/* Then warnings */}
              {openIssues
                .filter(i => i.severity === 'warning')
                .map(issue => (
                  <IssueItem 
                    key={issue.id} 
                    issue={issue}
                    onAcknowledge={() => handleAcknowledge(issue)}
                    onResolve={() => handleResolve(issue)}
                  />
                ))}
              {/* Then maintenance */}
              {scheduledMaintenance.slice(0, 2).map(event => (
                <MaintenanceItem key={event.id} event={event} />
              ))}
            </TabsContent>

            <TabsContent value="issues" className="m-0 space-y-3">
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Check className="h-8 w-8 text-accent" />
                  <p className="mt-2 text-sm font-medium">No Issues</p>
                  <p className="text-xs text-muted-foreground">All systems operating normally</p>
                </div>
              ) : (
                issues.map(issue => (
                  <IssueItem 
                    key={issue.id} 
                    issue={issue}
                    onAcknowledge={() => handleAcknowledge(issue)}
                    onResolve={() => handleResolve(issue)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="maintenance" className="m-0 space-y-3">
              {maintenanceEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No Maintenance Scheduled</p>
                  <p className="text-xs text-muted-foreground">All equipment up to date</p>
                </div>
              ) : (
                maintenanceEvents.map(event => (
                  <MaintenanceItem key={event.id} event={event} />
                ))
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="m-0 space-y-3">
              {!aiOptimizationActive ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">AI Optimization is Off</p>
                  <p className="text-xs text-muted-foreground">Turn it on in the header to generate recommendations</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No Recommendations</p>
                  <p className="text-xs text-muted-foreground">AI is analyzing the system</p>
                </div>
              ) : (
                recommendations.map(rec => (
                  <RecommendationItem key={rec.id} rec={rec} onApply={() => applyRecommendation(rec.id)} />
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
