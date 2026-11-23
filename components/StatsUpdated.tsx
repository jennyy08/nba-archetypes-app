const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

export default function StatsUpdated({ updatedAt }: { updatedAt?: string }) {
  if (!updatedAt) return null;

  const updated = new Date(updatedAt);
  if (!Number.isFinite(updated.getTime())) return null;

  return <time className="stats-updated" dateTime={updatedAt}>Stats updated {dateFormat.format(updated)}</time>;
}
