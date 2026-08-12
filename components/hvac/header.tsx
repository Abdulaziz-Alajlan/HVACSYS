'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Cpu, 
  LayoutDashboard, 
  Map, 
  Settings,
  Bell,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHVACStore } from '@/lib/hvac-store';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const { aiOptimizationActive, issues, toggleAIOptimization } = useHVACStore();
  const openIssues = issues.filter(i => i.status === 'open').length;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-foreground">AirWise</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                HVAC Optimization
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/">
                  <Button
                    variant={pathname === '/' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      pathname === '/' && 'bg-secondary'
                    )}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>System Dashboard</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/builder">
                  <Button
                    variant={pathname === '/builder' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      pathname === '/builder' && 'bg-secondary'
                    )}
                  >
                    <Map className="h-4 w-4" />
                    <span className="hidden sm:inline">HVAC Builder</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>System Builder & Topology</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={aiOptimizationActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleAIOptimization}
                  className={cn(
                    'gap-2 transition-all',
                    aiOptimizationActive && 'glow-primary'
                  )}
                >
                  <Sparkles className={cn('h-4 w-4', aiOptimizationActive && 'animate-pulse')} />
                  <span className="hidden md:inline">AI Optimization</span>
                  <Badge 
                    variant={aiOptimizationActive ? 'secondary' : 'outline'} 
                    className="ml-1 h-5 px-1.5 text-[10px]"
                  >
                    {aiOptimizationActive ? 'ON' : 'OFF'}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{aiOptimizationActive ? 'AI optimization is active' : 'Enable AI optimization'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {openIssues > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                      {openIssues}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{openIssues} open issues</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
