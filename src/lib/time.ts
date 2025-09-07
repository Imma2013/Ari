export function formatTimeDifference(now: Date, createdAt: string | Date): string {
  const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const diffInSeconds = Math.floor((now.getTime() - createdDate.getTime()) / 1000);
  
  const units = [
    { name: 'year', seconds: 31536000 },
    { name: 'month', seconds: 2592000 },
    { name: 'week', seconds: 604800 },
    { name: 'day', seconds: 86400 },
    { name: 'hour', seconds: 3600 },
    { name: 'minute', seconds: 60 },
    { name: 'second', seconds: 1 }
  ];

  for (const unit of units) {
    const interval = Math.floor(diffInSeconds / unit.seconds);
    if (interval >= 1) {
      return `${interval} ${unit.name}${interval !== 1 ? 's' : ''}`;
    }
  }
  
  return 'just now';
}
