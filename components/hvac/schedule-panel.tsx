'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Plus,
  Download,
  Upload,
  Trash2,
  Repeat,
  CalendarDays,
  Thermometer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHVACStore } from '@/lib/hvac-store';
import type { Schedule } from '@/lib/hvac-types';
import { roomTypeLabels } from '@/lib/hvac-mock-data';
import { cn } from '@/lib/utils';

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

interface ScheduleFormData {
  roomId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  targetTemp: number;
  priority: 'low' | 'medium' | 'high';
  recurrenceDays: number[];
  note: string;
}

const defaultFormData: ScheduleFormData = {
  roomId: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '18:00',
  targetTemp: 22,
  priority: 'medium',
  recurrenceDays: [1, 2, 3, 4, 5],
  note: '',
};

function ScheduleItem({ schedule, onDelete }: { schedule: Schedule; onDelete: () => void }) {
  const { rooms } = useHVACStore();
  const room = rooms.find(r => r.id === schedule.roomId);
  
  const startDate = new Date(schedule.activeDates.start);
  const endDate = new Date(schedule.activeDates.end);
  const isPermanent = schedule.scheduleType === 'permanent';

  return (
    <div className="group rounded-lg border border-border p-3 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'rounded-md p-1.5',
            isPermanent ? 'bg-primary/10' : 'bg-accent/10'
          )}>
            {isPermanent ? (
              <Repeat className="h-3.5 w-3.5 text-primary" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5 text-accent" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{room?.name ?? 'Unknown Room'}</p>
            <p className="text-xs text-muted-foreground">
              {roomTypeLabels[room?.roomType ?? 'office']}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {schedule.targetTemp}°C
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{schedule.activeTimes.start} - {schedule.activeTimes.end}</span>
        </div>
        {isPermanent ? (
          <div className="flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            <span>
              {schedule.recurrenceDays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
              {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={cn(
            'text-[10px]',
            schedule.status === 'Active' ? 'border-accent text-accent' :
            schedule.status === 'Upcoming' ? 'border-primary text-primary' :
            schedule.status === 'Recurring' ? 'border-info text-info' :
            ''
          )}
        >
          {schedule.status}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {schedule.source}
        </Badge>
      </div>
    </div>
  );
}

export function SchedulePanel() {
  const { rooms, schedules, addSchedule, removeSchedule } = useHVACStore();
  const [showTempDialog, setShowTempDialog] = useState(false);
  const [showPermDialog, setShowPermDialog] = useState(false);
  const [formData, setFormData] = useState<ScheduleFormData>(defaultFormData);

  const activeSchedules = schedules.filter(s => s.status === 'Active' || s.status === 'Recurring');
  const upcomingSchedules = schedules.filter(s => s.status === 'Upcoming');

  const handleCreateTemporary = () => {
    if (!formData.roomId) {
      toast.error('Please select a room');
      return;
    }

    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      roomId: formData.roomId,
      scheduleType: 'temporary',
      activeDates: {
        start: new Date(formData.startDate),
        end: new Date(formData.endDate),
      },
      activeTimes: {
        start: formData.startTime,
        end: formData.endTime,
      },
      targetTemp: formData.targetTemp,
      recurrenceDays: [],
      priorityLevel: formData.priority,
      source: 'manual',
      createdAt: new Date(),
      status: new Date(formData.startDate) > new Date() ? 'Upcoming' : 'Active',
    };

    addSchedule(newSchedule);
    setShowTempDialog(false);
    setFormData(defaultFormData);
    toast.success('Temporary schedule created', {
      description: `Cooling schedule added for ${rooms.find(r => r.id === formData.roomId)?.name}`,
    });
  };

  const handleCreatePermanent = () => {
    if (!formData.roomId) {
      toast.error('Please select a room');
      return;
    }

    if (formData.recurrenceDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      roomId: formData.roomId,
      scheduleType: 'permanent',
      activeDates: {
        start: new Date(),
        end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      activeTimes: {
        start: formData.startTime,
        end: formData.endTime,
      },
      targetTemp: formData.targetTemp,
      recurrenceDays: formData.recurrenceDays,
      priorityLevel: formData.priority,
      source: 'manual',
      createdAt: new Date(),
      status: 'Recurring',
    };

    addSchedule(newSchedule);
    setShowPermDialog(false);
    setFormData(defaultFormData);
    toast.success('Recurring schedule created', {
      description: `Weekly cooling schedule added for ${rooms.find(r => r.id === formData.roomId)?.name}`,
    });
  };

  const handleExport = () => {
    // Create a simple ICS file content
    const icsContent = schedules.map(schedule => {
      const room = rooms.find(r => r.id === schedule.roomId);
      const startDate = new Date(schedule.activeDates.start);
      const [startHour, startMin] = schedule.activeTimes.start.split(':');
      startDate.setHours(parseInt(startHour), parseInt(startMin));
      
      const endDate = new Date(schedule.activeDates.start);
      const [endHour, endMin] = schedule.activeTimes.end.split(':');
      endDate.setHours(parseInt(endHour), parseInt(endMin));

      return `BEGIN:VEVENT
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:HVAC Cooling - ${room?.name ?? 'Room'}
DESCRIPTION:Target temperature: ${schedule.targetTemp}°C
END:VEVENT`;
    }).join('\n');

    const fullIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AirWise//HVAC Schedules//EN
${icsContent}
END:VCALENDAR`;

    const blob = new Blob([fullIcs], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hvac-schedules.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Schedules exported', {
      description: 'Calendar file downloaded successfully',
    });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Simulate import
        toast.success('Calendar imported', {
          description: `Imported events from ${file.name}`,
        });

        // Add a sample imported schedule
        const importedSchedule: Schedule = {
          id: `schedule-import-${Date.now()}`,
          roomId: rooms[0]?.id ?? '',
          scheduleType: 'temporary',
          activeDates: {
            start: new Date(),
            end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
          activeTimes: {
            start: '10:00',
            end: '16:00',
          },
          targetTemp: 21,
          recurrenceDays: [],
          priorityLevel: 'medium',
          source: 'imported',
          createdAt: new Date(),
          status: 'Upcoming',
        };
        addSchedule(importedSchedule);
      }
    };
    input.click();
  };

  const toggleRecurrenceDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      recurrenceDays: prev.recurrenceDays.includes(day)
        ? prev.recurrenceDays.filter(d => d !== day)
        : [...prev.recurrenceDays, day].sort(),
    }));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Schedule Management</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {activeSchedules.length} active, {upcomingSchedules.length} upcoming
              </CardDescription>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowTempDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              Temporary
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShowPermDialog(true)}>
              <Repeat className="h-3.5 w-3.5" />
              Recurring
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="active">
            <TabsList className="grid h-8 w-full grid-cols-2">
              <TabsTrigger value="active" className="text-xs">
                Active
                {activeSchedules.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {activeSchedules.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs">
                Upcoming
                {upcomingSchedules.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {upcomingSchedules.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="mt-4 h-[280px] pr-4">
              <TabsContent value="active" className="m-0 space-y-3">
                {activeSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No Active Schedules</p>
                    <p className="text-xs text-muted-foreground">Create a schedule to get started</p>
                  </div>
                ) : (
                  activeSchedules.map(schedule => (
                    <ScheduleItem 
                      key={schedule.id} 
                      schedule={schedule}
                      onDelete={() => removeSchedule(schedule.id)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="m-0 space-y-3">
                {upcomingSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No Upcoming Schedules</p>
                    <p className="text-xs text-muted-foreground">Future schedules will appear here</p>
                  </div>
                ) : (
                  upcomingSchedules.map(schedule => (
                    <ScheduleItem 
                      key={schedule.id} 
                      schedule={schedule}
                      onDelete={() => removeSchedule(schedule.id)}
                    />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Temporary Schedule Dialog */}
      <Dialog open={showTempDialog} onOpenChange={setShowTempDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Temporary Schedule</DialogTitle>
            <DialogDescription>
              Set up a one-time cooling schedule for a specific date range
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="room">Room</Label>
              <Select value={formData.roomId} onValueChange={(v) => setFormData(d => ({ ...d, roomId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} - {roomTypeLabels[room.roomType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(d => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(d => ({ ...d, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(d => ({ ...d, startTime: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(d => ({ ...d, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="targetTemp">Target Temperature</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="targetTemp"
                    type="number"
                    min={16}
                    max={28}
                    value={formData.targetTemp}
                    onChange={(e) => setFormData(d => ({ ...d, targetTemp: parseInt(e.target.value) }))}
                  />
                  <span className="text-sm text-muted-foreground">°C</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(d => ({ ...d, priority: v as 'low' | 'medium' | 'high' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTempDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemporary}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Schedule Dialog */}
      <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Recurring Schedule</DialogTitle>
            <DialogDescription>
              Set up a weekly recurring cooling schedule
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="room-perm">Room</Label>
              <Select value={formData.roomId} onValueChange={(v) => setFormData(d => ({ ...d, roomId: v }))}>
                <SelectTrigger id="room-perm">
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} - {roomTypeLabels[room.roomType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Recurring Days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => (
                  <Button
                    key={day.value}
                    variant={formData.recurrenceDays.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-10"
                    onClick={() => toggleRecurrenceDay(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime-perm">Start Time</Label>
                <Input
                  id="startTime-perm"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(d => ({ ...d, startTime: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime-perm">End Time</Label>
                <Input
                  id="endTime-perm"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(d => ({ ...d, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="targetTemp-perm">Target Temperature</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="targetTemp-perm"
                    type="number"
                    min={16}
                    max={28}
                    value={formData.targetTemp}
                    onChange={(e) => setFormData(d => ({ ...d, targetTemp: parseInt(e.target.value) }))}
                  />
                  <span className="text-sm text-muted-foreground">°C</span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority-perm">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(d => ({ ...d, priority: v as 'low' | 'medium' | 'high' }))}
                >
                  <SelectTrigger id="priority-perm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePermanent}>Create Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
