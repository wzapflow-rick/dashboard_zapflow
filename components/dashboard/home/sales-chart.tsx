'use client';

const HOUR_LABELS = ['0h', '6h', '12h', '18h', '23h'];

export function SalesChart({ data }: { data: number[] }) {
  const hours = data.length === 24 ? data : new Array(24).fill(0);
  const max = Math.max(...hours, 1);

  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Vendas por hora do dia">
        {hours.map((value, index) => {
          const height = value === 0 ? 3 : Math.max(6, Math.round((value / max) * 100));

          return (
            <div key={index} className="group relative flex h-full flex-1 items-end">
              <div
                style={{ height: `${height}%` }}
                className="w-full rounded-t-[3px] bg-primary/70 transition-colors duration-200 group-hover:bg-primary"
              />
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                <span className="font-bold text-primary">{value}</span> às {index}h
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
        {HOUR_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
