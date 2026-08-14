'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  X,
  AlertCircle,
  ArrowUpDown,
  Users,
  Thermometer,
  Wind,
  ChevronRight,
} from 'lucide-react';
import { useHVACStore } from '@/lib/hvac-store';
import { roomTypeLabels } from '@/lib/hvac-mock-data';
import type { Room, CoolingStatus, RoomType } from '@/lib/hvac-types';
import { cn } from '@/lib/utils';
import { RoomDetailDrawer } from './room-detail-drawer';

const coolingStatusConfig: Record<CoolingStatus, { label: string; className: string }> = {
  'Inactive Cooling': { label: 'Inactive', className: 'bg-muted text-muted-foreground' },
  'Comfort Cooling': { label: 'Comfort', className: 'bg-accent/20 text-accent border-accent/30' },
  'Expected to Start in a Bit': { label: 'Expected Soon', className: 'bg-warning/20 text-warning border-warning/30' },
  'Coolers Started': { label: 'Active', className: 'bg-primary/20 text-primary border-primary/30' },
  'Starting in 10 Minutes': { label: 'Starting Soon', className: 'bg-info/20 text-info border-info/30' },
};

type SortField = 'name' | 'currentTemp' | 'comfortScore' | 'occupancyCount';
type SortDirection = 'asc' | 'desc';

export function RoomStatusTable() {
  const { rooms, coolingUnits, highlightedRoomId, setSelectedRoom, selectedRoomId, isInitialLoading } = useHVACStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CoolingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<RoomType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const filteredAndSortedRooms = useMemo(() => {
    let result = [...rooms];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(room => 
        room.name.toLowerCase().includes(searchLower) ||
        roomTypeLabels[room.roomType].toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(room => room.coolingStatus === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(room => room.roomType === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'currentTemp':
          comparison = a.currentTemp - b.currentTemp;
          break;
        case 'comfortScore':
          comparison = a.comfortScore - b.comfortScore;
          break;
        case 'occupancyCount':
          comparison = a.occupancyCount - b.occupancyCount;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [rooms, search, statusFilter, typeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getComfortBadge = (score: number) => {
    if (score >= 80) return { label: 'Optimal', className: 'bg-accent/20 text-accent' };
    if (score >= 65) return { label: 'Good', className: 'bg-primary/20 text-primary' };
    if (score >= 50) return { label: 'Fair', className: 'bg-warning/20 text-warning' };
    return { label: 'Poor', className: 'bg-destructive/20 text-destructive' };
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <>
      <Card className="col-span-2">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Room Cooling Status</CardTitle>
              <CardDescription className="text-xs">
                {filteredAndSortedRooms.length} of {rooms.length} rooms
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search rooms..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn('h-8 w-[180px] pl-8 text-xs', search && 'pr-7')}
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CoolingStatus | 'all')}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.keys(coolingStatusConfig).map(status => (
                    <SelectItem key={status} value={status}>
                      {coolingStatusConfig[status as CoolingStatus].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as RoomType | 'all')}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(roomTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('name')}
                      className="-ml-3 h-8 gap-1 text-xs font-medium"
                    >
                      Room
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[90px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('currentTemp')}
                      className="-ml-3 h-8 gap-1 text-xs font-medium"
                    >
                      Temp
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">Target</TableHead>
                  <TableHead className="w-[90px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('occupancyCount')}
                      className="-ml-3 h-8 gap-1 text-xs font-medium"
                    >
                      Occup.
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px]">Damper</TableHead>
                  <TableHead className="w-[80px]">Unit</TableHead>
                  <TableHead className="w-[90px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('comfortScore')}
                      className="-ml-3 h-8 gap-1 text-xs font-medium"
                    >
                      Comfort
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Next Action</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} aria-busy="true">
                      <TableCell colSpan={10}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredAndSortedRooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">
                      {rooms.length === 0
                        ? 'No rooms configured for this building.'
                        : 'No rooms match your search or filters.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedRooms.map(room => {
                  const unit = coolingUnits.find(u => u.id === room.assignedCoolingUnit);
                  const statusConfig = coolingStatusConfig[room.coolingStatus];
                  const comfortBadge = getComfortBadge(room.comfortScore);
                  const isHighlighted = room.id === highlightedRoomId;
                  const tempDelta = room.currentTemp - room.targetTemp;

                  return (
                    <TableRow
                      key={room.id}
                      className={cn(
                        'cursor-pointer transition-colors focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset',
                        isHighlighted && 'bg-primary/5'
                      )}
                      onClick={() => setSelectedRoom(room.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRoom(room.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${room.name}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{room.name}</span>
                          {room.issueFlags.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-3.5 w-3.5 text-warning" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{room.issueFlags.join(', ')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {roomTypeLabels[room.roomType]}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Thermometer className={cn(
                            'h-3.5 w-3.5',
                            tempDelta > 2 ? 'text-destructive' : tempDelta < -1 ? 'text-accent' : 'text-muted-foreground'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            tempDelta > 2 ? 'text-destructive' : tempDelta < -1 ? 'text-accent' : ''
                          )}>
                            {room.currentTemp}°C
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {room.targetTemp}°C
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {room.occupancyCount}/{room.capacity}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{room.damperPosition}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {unit?.name ?? 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px]', comfortBadge.className)}>
                          {room.comfortScore}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-[10px]', statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {room.coolingStatus === 'Starting in 10 Minutes' ? 'Start cooling' :
                         room.coolingStatus === 'Expected to Start in a Bit' ? 'Pre-cool' :
                         room.coolingStatus === 'Inactive Cooling' ? 'Standby' :
                         'Maintain'}
                      </TableCell>
                      <TableCell>
                        {/* Decorative only — the whole row is the real,
                            keyboard-operable control (see tabIndex/role/
                            onKeyDown above); this chevron doesn't need its
                            own focus stop or label. */}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RoomDetailDrawer 
        room={selectedRoom} 
        open={!!selectedRoom} 
        onClose={() => setSelectedRoom(null)} 
      />
    </>
  );
}
