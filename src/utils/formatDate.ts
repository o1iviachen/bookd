import { format, isToday, isYesterday, isTomorrow, parseISO } from 'date-fns';

export function formatMatchDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d, yyyy');
}

export function formatMatchTime(dateString: string): string {
  return format(parseISO(dateString), 'h:mm a');
}

export function formatFullDate(dateString: string): string {
  return format(parseISO(dateString), 'EEEE, MMMM d, yyyy');
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, 'MMM d');
}

export function toApiDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
