import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AdminAttendanceModal, { type AttendanceRecord } from '@/components/AdminAttendanceModal';
import { API_BASE_URL, authHeader } from '@/lib/api';
import { formatInr } from '@/lib/events';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Link as LinkIcon,
  LogOut,
  MapPin,
  Plus,
  Trophy,
  Trash2,
  Users,
} from 'lucide-react';

interface Event {
  id: number;
  name: string;
  date: string;
  time: string;
  venue: string;
  duration: string;
  is_paid: boolean;
  entry_fees: number | null;
  prize: string | null;
  registration_link: string | null;
  event_type: string | null;
}

interface InterestRecord {
  id: number;
  event_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_picture: string | null;
  registered_at: string;
}

const emptyForm = {
  name: '',
  date: '',
  time: '',
  venue: '',
  duration: '',
  is_paid: false,
  entry_fees: '' as string | number,
  prize: '',
  registration_link: '',
  event_type: '',
};

function validateEventDate(date: string): string | null {
  if (!date) {
    return null;
  }

  const eventYear = Number(date.slice(0, 4));
  const currentYear = new Date().getFullYear();

  if (Number.isNaN(eventYear)) {
    return 'Enter a valid event date.';
  }

  if (eventYear < currentYear - 5) {
    return `Event year looks incorrect: ${date}. If this is a new event, use ${currentYear}${date.slice(4)} instead.`;
  }

  return null;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [events, setEvents] = useState<Event[]>([]);
  const [interests, setInterests] = useState<InterestRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceQuery, setAttendanceQuery] = useState('');
  const [attendanceUpdatingIds, setAttendanceUpdatingIds] = useState<Set<number>>(new Set());

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: authHeader() });
      if (res.ok) setEvents(await res.json());
    } catch (error) {
      console.error('Failed to fetch admin events:', error);
    }
  }, []);

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/interests`, { headers: authHeader() });
      if (res.ok) setInterests(await res.json());
    } catch (error) {
      console.error('Failed to fetch event interests:', error);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchInterests()]);
  }, [fetchEvents, fetchInterests]);

  useEffect(() => {
    void refreshDashboard();
    const interval = setInterval(() => void refreshDashboard(), 10000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  const fetchAttendance = useCallback(async (eventId: number) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events/${eventId}/attendance`, { headers: authHeader() });
      setAttendanceRecords(res.ok ? await res.json() : []);
    } catch {
      setAttendanceRecords([]);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    void fetchAttendance(selectedEvent.id);
    const interval = setInterval(() => void fetchAttendance(selectedEvent.id), 10000);
    return () => clearInterval(interval);
  }, [fetchAttendance, selectedEvent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const dateError = validateEventDate(form.date);
    if (dateError) {
      setFormError(dateError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          ...form,
          entry_fees: form.is_paid && form.entry_fees !== '' ? Number(form.entry_fees) : null,
          prize: form.prize || null,
          registration_link: form.registration_link || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) setFormError(data.error || 'Failed to create event');
      else {
        setFormSuccess(`Event "${data.name}" created successfully.`);
        setForm(emptyForm);
        await refreshDashboard();
      }
    } catch {
      setFormError('Network error. Is the backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete event "${name}"?`)) return;
    const res = await fetch(`${API_BASE_URL}/api/admin/events/${id}`, { method: 'DELETE', headers: authHeader() });
    if (res.ok) {
      if (selectedEvent?.id === id) setSelectedEvent(null);
      await refreshDashboard();
    }
  };

  const toggleAttendance = async (userId: number, attended: boolean) => {
    if (!selectedEvent) return;
    setAttendanceUpdatingIds(prev => new Set(prev).add(userId));
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events/${selectedEvent.id}/attendance/${userId}`, {
        method: attended ? 'DELETE' : 'POST',
        headers: authHeader(),
      });
      if (res.ok) {
        setAttendanceRecords(prev => prev.map(record => record.user_id === userId ? {
          ...record,
          attended: !attended,
          marked_at: attended ? null : new Date().toISOString(),
          marked_by: attended ? null : user.id,
        } : record));
      }
    } catch (error) {
      console.error('Failed to update attendance:', error);
    } finally {
      setAttendanceUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const interestsByEvent = interests.reduce<Record<number, InterestRecord[]>>((acc, record) => {
    (acc[record.event_id] ??= []).push(record);
    return acc;
  }, {});

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/silver-oak-logo.svg" alt="Silver Oak University" className="h-10 w-auto max-w-[170px]" />
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-foreground">Campus Events</p>
              <p className="text-[11px] text-muted-foreground">Silver Oak University</p>
            </div>
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            {user.picture && <img src={user.picture} alt="avatar" className="h-8 w-8 rounded-full ring-2 ring-border" />}
            <span className="hidden text-sm font-medium text-foreground sm:block">{user.name || user.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage events, review interest, and mark attendance.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard icon={<CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />} title="Total Events" value={events.length} tone="bg-blue-100 dark:bg-blue-900/30" />
          <StatCard icon={<Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />} title="Interested Users" value={interests.length} tone="bg-violet-100 dark:bg-violet-900/30" />
          <StatCard icon={<ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} title="Free Events" value={events.filter(event => !event.is_paid).length} tone="bg-emerald-100 dark:bg-emerald-900/30" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Event</CardTitle>
            <CardDescription>Fill in the details to publish a new event.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Event Name" required><Input id="name" name="name" value={form.name} onChange={handleChange} required /></Field>
                <Field label="Date" required><Input id="date" type="date" name="date" value={form.date} onChange={handleChange} required /></Field>
                <Field label="Time" required><Input id="time" type="time" name="time" value={form.time} onChange={handleChange} required /></Field>
                <Field label="Duration" required><Input id="duration" name="duration" value={form.duration} onChange={handleChange} required placeholder="e.g. 2 hours" /></Field>
              </div>
              <Field label="Venue" required><Input id="venue" name="venue" value={form.venue} onChange={handleChange} required /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Event Type"><Select id="event_type" name="event_type" value={form.event_type} onChange={handleChange}><option value="">-- Select type --</option><option value="workshop">Workshop</option><option value="seminar">Seminar</option><option value="culture">Culture</option><option value="expert talk">Expert Talk</option><option value="guest lecture">Guest Lecture</option><option value="VAC">VAC</option><option value="hands on training">Hands On Training</option><option value="orientation">Orientation</option><option value="awareness">Awareness</option></Select></Field>
                <Field label="Registration Link"><Input id="registration_link" type="url" name="registration_link" value={form.registration_link} onChange={handleChange} placeholder="https://forms.gle/..." /></Field>
              </div>
              <Field label="Prize"><Input id="prize" name="prize" value={form.prize} onChange={handleChange} placeholder="e.g. INR 50,000 cash prize" /></Field>
              <div className="flex items-center gap-2">
                <input id="is_paid" type="checkbox" name="is_paid" checked={form.is_paid} onChange={handleChange} className="h-4 w-4 rounded border-input accent-primary" />
                <Label htmlFor="is_paid" className="cursor-pointer">Paid Event</Label>
              </div>
              {form.is_paid && <Field label="Entry Fees (INR)" required><Input id="entry_fees" type="number" name="entry_fees" value={form.entry_fees as string} onChange={handleChange} required min="0" step="0.01" /></Field>}
              {formError && <AlertBox tone="error" text={formError} />}
              {formSuccess && <AlertBox tone="success" text={formSuccess} />}
              <Button type="submit" disabled={submitting} className="gap-2"><Plus className="h-4 w-4" /> {submitting ? 'Creating...' : 'Create Event'}</Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Events <span className="ml-2 text-sm font-normal text-muted-foreground">({events.length})</span></h2>
          {events.length === 0 ? <EmptyCard icon={<CalendarDays className="h-10 w-10 text-muted-foreground/40" />} text="No events yet. Create one above." /> : (
            <div className="space-y-3">
              {events.map(event => {
                const interestCount = interestsByEvent[event.id]?.length ?? 0;
                const interestedPreview = (interestsByEvent[event.id] ?? [])
                  .slice(0, 3)
                  .map(record => record.user_name || record.user_email)
                  .join(', ');
                return (
                  <Card key={event.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{event.name}</h3>
                            <Badge variant={event.is_paid ? 'destructive' : 'success'}>{event.is_paid ? 'Paid' : 'Free'}</Badge>
                            {event.event_type && <Badge variant="info">{event.event_type}</Badge>}
                            <Badge variant={interestCount > 0 ? 'secondary' : 'outline'}><Users className="mr-1 h-3 w-3" /> {interestCount} interested</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {event.date} at {event.time}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.venue}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.duration}</span>
                            {event.is_paid && event.entry_fees != null && <span>{formatInr(event.entry_fees)}</span>}
                            {event.prize && <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {event.prize}</span>}
                          </div>
                          {interestCount > 0 && (
                            <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Interested for this event: {interestedPreview}
                              {interestCount > 3 ? ` +${interestCount - 3} more` : ''}
                            </p>
                          )}
                          {event.registration_link && <a href={event.registration_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><LinkIcon className="h-3 w-3" /> Registration Link <ChevronRight className="h-3 w-3" /></a>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setAttendanceQuery(''); setSelectedEvent(event); }} className="gap-1.5 text-xs"><ClipboardCheck className="h-3.5 w-3.5" /> Attendance</Button>
                          <Button variant="ghost" size="sm" onClick={() => void handleDelete(event.id, event.name)} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Interested Users</h2>
            <Badge variant="secondary">{interests.length} registration{interests.length !== 1 ? 's' : ''}</Badge>
          </div>
          {interests.length === 0 ? <EmptyCard icon={<Users className="h-10 w-10 text-muted-foreground/40" />} text="No users have expressed interest yet." /> : (
            <div className="space-y-4">
              {events.filter(event => (interestsByEvent[event.id]?.length ?? 0) > 0).map(event => (
                <Card key={event.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-5 py-3">
                    <strong className="text-sm text-foreground">{event.name}</strong>
                    <span className="text-xs text-muted-foreground">{interestsByEvent[event.id].length} interested</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/20"><th className="w-10 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">#</th><th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">User</th><th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Email</th><th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th><th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Registered At</th></tr></thead>
                      <tbody>{interestsByEvent[event.id].map((record, index) => <tr key={record.id} className="border-b last:border-0"><td className="px-4 py-3 text-xs text-muted-foreground">{index + 1}</td><td className="px-4 py-3"><div className="flex items-center gap-2">{record.user_picture ? <img src={record.user_picture} alt="" className="h-7 w-7 rounded-full" /> : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">{(record.user_name || record.user_email)[0].toUpperCase()}</div>}<span className="text-xs font-medium text-foreground">{record.user_name || '-'}</span></div></td><td className="px-4 py-3 text-xs text-muted-foreground">{record.user_email}</td><td className="px-4 py-3 text-xs"><Badge variant="secondary">Interested</Badge></td><td className="px-4 py-3 text-xs text-muted-foreground">{record.registered_at ? new Date(record.registered_at).toLocaleString() : '-'}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedEvent && <AdminAttendanceModal event={selectedEvent} records={attendanceRecords} loading={attendanceLoading} query={attendanceQuery} updatingIds={attendanceUpdatingIds} onClose={() => { setSelectedEvent(null); setAttendanceRecords([]); setAttendanceQuery(''); setAttendanceUpdatingIds(new Set()); }} onQueryChange={setAttendanceQuery} onToggle={(userId, attended) => void toggleAttendance(userId, attended)} />}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label} {required && <span className="text-destructive">*</span>}</Label>{children}</div>;
}

function AlertBox({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  if (tone === 'error') return <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /><span>{text}</span></div>;
  return <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /><span>{text}</span></div>;
}

function EmptyCard({ icon, text }: { icon: ReactNode; text: string }) {
  return <Card><CardContent className="py-12 text-center">{icon}<p className="mt-3 text-sm text-muted-foreground">{text}</p></CardContent></Card>;
}

function StatCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: number; tone: string }) {
  return <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>{icon}</div><div><p className="text-2xl font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{title}</p></div></div></CardContent></Card>;
}
