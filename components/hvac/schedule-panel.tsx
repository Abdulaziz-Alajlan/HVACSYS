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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                aria-label={`Delete schedule for ${room?.name ?? 'this room'}`}
                title="Delete schedule"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
                <AlertDialogDescription>
                  The cooling schedule for {room?.name ?? 'this room'} will be removed. This
                  can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} -
              {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
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

  // Parses the .ics format handleExport actually produces (BEGIN:VEVENT
  // blocks with DTSTART/DTEND/SUMMARY/DESCRIPTION) — previously this claimed
  // success and added one canned schedule regardless of the file's real
  // contents. Matches SUMMARY's "HVAC Cooling - {room name}" back to a real
  // room when possible; falls back to the first room otherwise.
  const parseIcsEvents = (icsText: string): Schedule[] => {
    const eventBlocks = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

    return eventBlocks
      .map((block, i): Schedule | null => {
        const dtStart = block.match(/DTSTART:(\d{8}T\d{6})Z?/)?.[1];
        const dtEnd = block.match(/DTEND:(\d{8}T\d{6})Z?/)?.[1];
        const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
        const tempMatch = block.match(/Target temperature:\s*(-?\d+(?:\.\d+)?)/);

        if (!dtStart || !dtEnd) return null;

        const parseIcsDate = (raw: string) => {
          const year = Number(raw.slice(0, 4));
          const month = Number(raw.slice(4, 6)) - 1;
          const day = Number(raw.slice(6, 8));
          const hour = Number(raw.slice(9, 11));
          const minute = Number(raw.slice(11, 13));
          return new Date(Date.UTC(year, month, day, hour, minute));
        };

        const start = parseIcsDate(dtStart);
        const end = parseIcsDate(dtEnd);
        const roomName = summary?.replace(/^HVAC Cooling - /, '');
        const matchedRoom = roomName ? rooms.find(r => r.name === roomName) : undefined;

        return {
          id: `schedule-import-${Date.now()}-${i}`,
          roomId: matchedRoom?.id ?? rooms[0]?.id ?? '',
          scheduleType: 'temporary',
          activeDates: {
            start,
            end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
          },
          activeTimes: {
            start: `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`,
            end: `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`,
          },
          targetTemp: tempMatch ? parseFloat(tempMatch[1]) : 21,
          recurrenceDays: [],
          priorityLevel: 'medium',
          source: 'imported',
          createdAt: new Date(),
          status: 'Upcoming',
        };
      })
      .filter((s): s is Schedule => s !== null);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const imported = parseIcsEvents(text);

      if (imported.length === 0) {
        toast.error('Import failed', {
          description: `No valid calendar events found in ${file.name}. Only .ics files exported from this app are supported.`,
        });
        return;
      }

      imported.forEach(addSchedule);
      toast.success('Calendar imported', {
        description: `Imported ${imported.length} event${imported.length === 1 ? '' : 's'} from ${file.name}`,
      });
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
            <TabsList className="grid h-8 w-full max-w-xs grid-cols-2">
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
              <TabsContent value="active" className="m-0">
                {activeSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No Active Schedules</p>
                    <p className="text-xs text-muted-foreground">Create a schedule to get started</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {activeSchedules.map(schedule => (
                      <ScheduleItem
                        key={schedule.id}
                        schedule={schedule}
                        onDelete={() => removeSchedule(schedule.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="m-0">
                {upcomingSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No Upcoming Schedules</p>
                    <p className="text-xs text-muted-foreground">Future schedules will appear here</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {upcomingSchedules.map(schedule => (
                      <ScheduleItem
                        key={schedule.id}
                        schedule={schedule}
                        onDelete={() => removeSchedule(schedule.id)}
                      />
                    ))}
                  </div>
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
