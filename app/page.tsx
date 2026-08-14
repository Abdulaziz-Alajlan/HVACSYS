'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Map,
  Plus,
  Download,
  RefreshCw,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/hvac/header';
import { KPICards } from '@/components/hvac/kpi-cards';
import { UtilizationChart } from '@/components/hvac/utilization-chart';
import { CoolingBreakdownChart } from '@/components/hvac/cooling-breakdown-chart';
import { RoomStatusTable } from '@/components/hvac/room-status-table';
import { IssuesPanel } from '@/components/hvac/issues-panel';
import { SchedulePanel } from '@/components/hvac/schedule-panel';
import { AIInsightsCard } from '@/components/hvac/ai-insights-card';
import { useHVACStore } from '@/lib/hvac-store';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const {
    initialize,
    lastUpdated,
    aiOptimizationActive,
    simulationRunning,
    toggleSimulation,
    runSimulationTick,
    refreshData,
    dataSource,
  } = useHVACStore();

  // Initialize data on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Run simulation tick
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      runSimulationTick();
    }, 3000);

    return () => clearInterval(interval);
  }, [simulationRunning, runSimulationTick]);

  // This page prerenders as static HTML (no dynamic APIs used), so the
  // server-rendered "Updated X ago" text is frozen at build/prerender time —
  // computing it again on the client during hydration mismatches whatever
  // "now" was then. Same mounted-gate pattern as kpi-cards.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const lastUpdatedText = mounted && lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : '—';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 lg:px-6">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              System Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time HVAC monitoring and optimization overview
            </p>
            <div className="mt-2 flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Updated {lastUpdatedText}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Last data refresh</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {aiOptimizationActive && (
                <Badge variant="outline" className="gap-1 text-[10px] text-primary border-primary/30">
                  <Sparkles className="h-3 w-3" />
                  AI Active
                </Badge>
              )}
              {simulationRunning && (
                <Badge variant="outline" className="gap-1 text-[10px] text-accent border-accent/30">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Live
                </Badge>
              )}
              {dataSource === 'mock-fallback' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-1 text-[10px] text-warning border-warning/30">
                        <AlertTriangle className="h-3 w-3" />
                        Offline — showing mock data
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Backend unreachable — this is placeholder data, not live sensor readings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/builder">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Map className="h-4 w-4" />
                      <span className="hidden sm:inline">View HVAC Map</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open system builder</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={simulationRunning ? 'default' : 'outline'} 
                    size="sm" 
                    className="gap-2"
                    onClick={toggleSimulation}
                  >
                    <RefreshCw className={`h-4 w-4 ${simulationRunning ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">
                      {simulationRunning ? 'Stop Sim' : 'Start Sim'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{simulationRunning ? 'Stop live simulation' : 'Start live simulation'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" onClick={refreshData}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh all data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* KPI Cards */}
        <section className="mb-6">
          <KPICards />
        </section>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Charts */}
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-6 md:grid-cols-2">
              <UtilizationChart />
              <CoolingBreakdownChart />
            </div>
            
            {/* Room Status Table */}
            <RoomStatusTable />
          </div>

          {/* Right Column - Panels */}
          <div className="space-y-6">
            <AIInsightsCard />
            <IssuesPanel />
            <SchedulePanel />
          </div>
        </div>
      </main>
    </div>
  );
}
