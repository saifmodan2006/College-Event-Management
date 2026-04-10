import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays, MapPin, Clock, Trophy, Link as LinkIcon,
  Star, LogOut, ChevronRight, BookmarkCheck,
  CalendarX, History, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { API_BASE_URL, authHeader } from '@/lib/api';
import { formatInr, getLocalDateString } from '@/lib/events';

interface Event {
  id: number;
  name: string;
  date: string;
  time: string;
  venue: string;
  duration: string;
  event_type: string | null;
  is_paid: boolean;
  entry_fees: number | null;
  prize: string | null;
  registration_link: string | null;
}

export default function UserPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [events, setEvents] = useState<Event[]>([]);
  const [interestedIds, setInterestedIds] = useState<Set<number>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interestsSectionRef = useRef<HTMLElement | null>(null);
  const [scrollToInterests, setScrollToInterests] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const fetchData = async () => {
    try {
      const [evRes, intRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/events`, { headers: authHeader() }),
        fetch(`${API_BASE_URL}/api/events/my-interests`, { headers: authHeader() }),
      ]);
      if (evRes.ok) setEvents(await evRes.json());
      if (intRes.ok) {
        const ids: number[] = await intRes.json();
        setInterestedIds(new Set(ids));
      }
    } catch { /* silently ignore */ }
  };

  useEffect(() => {
    fetchData();

    // Poll for new events every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!scrollToInterests || interestedIds.size === 0) {
      return;
    }

    interestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollToInterests(false);
  }, [interestedIds, scrollToInterests]);

  const toggleInterest = async (eventId: number, eventName: string) => {
    setLoadingIds(prev => new Set(prev).add(eventId));
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/interest`, {
        method: 'POST',
        headers: authHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.interested) {
          setScrollToInterests(true);
        }
        setInterestedIds(prev => {
          const next = new Set(prev);
          if (data.interested) {
            next.add(eventId);
            showToast(`Added "${eventName}" to your interests!`);
          } else {
            next.delete(eventId);
            showToast(`Removed "${eventName}" from your interests.`);
          }
          return next;
        });
      } else {
        showToast('Something went wrong. Try again.', 'error');
      }
    } catch {
      showToast('Network error. Is the backend running?', 'error');
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const today = getLocalDateString();
  const upcomingOngoing = [...events]
    .filter(ev => ev.date >= today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const pastEvents = events
    .filter(ev => ev.date < today)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  const myInterestEvents = [...events]
    .filter(ev => interestedIds.has(ev.id))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  return (
    <div className="min-h-screen bg-background">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-600 dark:bg-emerald-700'
            : 'bg-destructive'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/silver-oak-logo.svg"
                alt="Silver Oak University"
                className="h-10 w-auto max-w-[170px]"
              />
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-foreground">Campus Events</p>
              <p className="text-[11px] text-muted-foreground">Silver Oak University</p>
            </div>
            <Badge variant="info" className="text-xs">Student</Badge>
          </div>
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-border" />
            )}
            <span className="text-sm font-medium text-foreground hidden sm:block">{user.name || user.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* Upcoming & Ongoing Events */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Upcoming &amp; Ongoing Events</h2>
              <p className="text-xs text-muted-foreground">{upcomingOngoing.length} event{upcomingOngoing.length !== 1 ? 's' : ''} available</p>
            </div>
          </div>

          {upcomingOngoing.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <CalendarX className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No upcoming events at the moment.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingOngoing.map(ev => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  today={today}
                  interested={interestedIds.has(ev.id)}
                  loading={loadingIds.has(ev.id)}
                  onToggle={toggleInterest}
                />
              ))}
            </div>
          )}
        </section>

        {/* My Interests */}
        <section ref={interestsSectionRef} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <BookmarkCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">My Interests</h2>
              <p className="text-xs text-muted-foreground">{myInterestEvents.length} event{myInterestEvents.length !== 1 ? 's' : ''} saved</p>
            </div>
          </div>

          {myInterestEvents.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Star className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">You haven't marked interest in any events yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Browse events above and click "I'm Interested"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myInterestEvents.map(ev => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  today={today}
                  interested={true}
                  loading={loadingIds.has(ev.id)}
                  onToggle={toggleInterest}
                  inInterestSection
                />
              ))}
            </div>
          )}
        </section>

        {/* Past Events */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Past Events</h2>
              <p className="text-xs text-muted-foreground">{pastEvents.length} event{pastEvents.length !== 1 ? 's' : ''} in history</p>
            </div>
          </div>

          {pastEvents.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <History className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No past events to show.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastEvents.map(ev => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  today={today}
                  interested={interestedIds.has(ev.id)}
                  loading={loadingIds.has(ev.id)}
                  onToggle={toggleInterest}
                  readonly
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface EventCardProps {
  event: Event;
  today: string;
  interested: boolean;
  loading: boolean;
  onToggle: (id: number, name: string) => void;
  readonly?: boolean;
  inInterestSection?: boolean;
}

function EventCard({ event: ev, today, interested, loading, onToggle, readonly, inInterestSection }: EventCardProps) {
  const isOngoing = ev.date === today;
  const isPast = ev.date < today;

  return (
    <Card className={`hover:shadow-md transition-all ${interested && !readonly ? 'ring-1 ring-primary/30' : ''} ${readonly ? 'opacity-80' : ''}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <h3 className="font-semibold text-foreground text-sm">{ev.name}</h3>
              {isOngoing && <Badge variant="warning">Ongoing</Badge>}
              {isPast && <Badge variant="outline" className="text-gray-500">Past</Badge>}
              {interested && <Badge variant="secondary">Interested</Badge>}
              {ev.event_type && <Badge variant="info">{ev.event_type}</Badge>}
              <Badge variant={ev.is_paid ? 'destructive' : 'success'}>
                {ev.is_paid ? 'Paid' : 'Free'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3 shrink-0" /> {ev.date} at {ev.time}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" /> {ev.venue}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" /> {ev.duration}
              </span>
              {ev.is_paid && ev.entry_fees != null && (
                <span className="flex items-center gap-1">
                  {formatInr(ev.entry_fees)}
                </span>
              )}
              {ev.prize && (
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 shrink-0" /> {ev.prize}
                </span>
              )}
            </div>

            {ev.registration_link && (
              <a
                href={ev.registration_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2.5 text-xs text-primary hover:underline"
              >
                <LinkIcon className="w-3 h-3" /> Registration Link
                <ChevronRight className="w-3 h-3" />
              </a>
            )}

            {interested && (
              <p className="mt-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {inInterestSection ? 'Saved in My Interests.' : 'You are interested in this event.'}
              </p>
            )}
          </div>

          {!readonly && (
            <Button
              onClick={() => onToggle(ev.id, ev.name)}
              disabled={loading}
              variant={interested ? 'default' : 'outline'}
              size="sm"
              className={`shrink-0 gap-1.5 ${
                interested
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${interested ? 'fill-current' : ''}`} />
              {loading ? '...' : interested ? 'Interested' : "I'm Interested"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
