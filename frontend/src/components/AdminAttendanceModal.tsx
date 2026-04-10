import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, XCircle } from 'lucide-react';

export interface AttendanceRecord {
  user_id: number;
  user_name: string;
  user_email: string;
  user_picture: string | null;
  interested: boolean;
  registered_at: string | null;
  attended: boolean;
  marked_at: string | null;
  marked_by: number | null;
}

interface Props {
  event: { id: number; name: string };
  records: AttendanceRecord[];
  loading: boolean;
  query: string;
  updatingIds: Set<number>;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onToggle: (userId: number, attended: boolean) => void;
}

export default function AdminAttendanceModal({
  event,
  records,
  loading,
  query,
  updatingIds,
  onClose,
  onQueryChange,
  onToggle,
}: Props) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = records.filter(record => {
    if (!normalizedQuery) return true;
    return [record.user_name, record.user_email].some(value => value?.toLowerCase().includes(normalizedQuery));
  });

  const attendedCount = records.filter(record => record.attended).length;
  const interestedCount = records.filter(record => record.interested).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-lg bg-background shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="text-lg font-semibold">Event Attendance</h3>
            <p className="text-sm text-muted-foreground">{event.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading attendance...</div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No student users found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">{attendedCount} attended</Badge>
                  <Badge variant="outline">{interestedCount} interested</Badge>
                  <span>{records.length} total students</span>
                </div>
                <Input
                  value={query}
                  onChange={e => onQueryChange(e.target.value)}
                  placeholder="Search by student name or email"
                  className="w-full sm:max-w-xs"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No matching users found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">User</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Interest</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Interested At</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Attendance</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(record => {
                        const isUpdating = updatingIds.has(record.user_id);
                        return (
                          <tr key={record.user_id} className="border-b last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {record.user_picture ? (
                                  <img src={record.user_picture} alt="" className="h-8 w-8 rounded-full" />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                                    {(record.user_name || record.user_email)[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-foreground">{record.user_name || '-'}</p>
                                  <p className="text-xs text-muted-foreground">User ID: {record.user_id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{record.user_email}</td>
                            <td className="px-4 py-3">
                              <Badge variant={record.interested ? 'secondary' : 'outline'}>
                                {record.interested ? 'Interested' : 'Not interested'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {record.registered_at ? new Date(record.registered_at).toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={record.attended ? 'success' : 'outline'}>
                                {record.attended ? 'Present' : 'Absent'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant={record.attended ? 'outline' : 'default'}
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => onToggle(record.user_id, record.attended)}
                                className={record.attended ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
                              >
                                {isUpdating ? 'Saving...' : record.attended ? 'Remove Mark' : 'Mark Present'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t p-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
