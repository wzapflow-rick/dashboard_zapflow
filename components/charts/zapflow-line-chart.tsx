'use client';

import { useId, useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface ZapflowLineChartPoint {
  label: string;
  value: number;
  detail?: string;
}

interface ZapflowLineChartProps {
  data: ZapflowLineChartPoint[];
  valueLabel: string;
  formatValue?: (value: number) => string;
  formatYAxis?: (value: number) => string;
  className?: string;
  compact?: boolean;
  showYAxis?: boolean;
  emptyMessage?: string;
}

interface LineTooltipProps extends Partial<TooltipContentProps<number, string>> {
  valueLabel: string;
  formatValue: (value: number) => string;
}

interface LineDotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

function LineTooltip({ active, payload, valueLabel, formatValue }: LineTooltipProps) {
  const point = payload?.[0]?.payload as ZapflowLineChartPoint | undefined;

  if (!active || !point) return null;

  return (
    <div className="min-w-40 rounded-xl border border-slate-200/70 bg-background-light/95 p-3 shadow-xl backdrop-blur-md dark:border-border-dark dark:bg-surface-dark/95">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{point.label}</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="size-2 rounded-full bg-primary shadow-sm shadow-primary/50" aria-hidden="true" />
          {valueLabel}
        </span>
        <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatValue(point.value)}</span>
      </div>
      {point.detail ? <p className="mt-2 border-t border-slate-200/70 pt-2 text-xs text-slate-500 dark:border-border-dark dark:text-slate-400">{point.detail}</p> : null}
    </div>
  );
}

export function ZapflowLineChart({
  data,
  valueLabel,
  formatValue = (value) => value.toLocaleString('pt-BR'),
  formatYAxis = (value) => value.toLocaleString('pt-BR'),
  className,
  compact = false,
  showYAxis = true,
  emptyMessage = 'Nenhum dado disponível',
}: ZapflowLineChartProps) {
  const rawId = useId();
  const chartId = rawId.replace(/:/g, '');
  const patternId = `zapflow-chart-pattern-${chartId}`;
  const latestLabel = data.at(-1)?.label;

  const highlightedIndexes = useMemo(() => {
    if (data.length <= 2) return new Set(data.map((_, index) => index));

    const peakIndex = data.reduce(
      (highestIndex, point, index) => (point.value > data[highestIndex].value ? index : highestIndex),
      0,
    );

    return new Set([peakIndex, data.length - 1]);
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-60 w-full items-center justify-center rounded-xl border border-dashed border-slate-200/80 bg-slate-100/40 text-sm text-slate-500 dark:border-border-dark dark:bg-surface-dark/40 dark:text-slate-400',
          compact && 'h-36',
          className,
        )}
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  const renderDot = ({ cx, cy, index }: LineDotProps) => {
    if (cx === undefined || cy === undefined || index === undefined || !highlightedIndexes.has(index)) {
      return <g key={`empty-dot-${index ?? 'unknown'}`} />;
    }

    return (
      <circle
        key={`highlight-dot-${index}`}
        cx={cx}
        cy={cy}
        r={compact ? 4 : 5}
        fill="var(--color-primary)"
        stroke="var(--color-background-light)"
        strokeWidth={2}
      />
    );
  };

  return (
    <div
      className={cn('h-60 w-full', compact && 'h-36', className)}
      role="img"
      aria-label={`${valueLabel}: evolução em ${data.length} pontos`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          accessibilityLayer
          data={data}
          margin={{ top: 16, right: compact ? 8 : 12, bottom: 4, left: 0 }}
        >
          <defs>
            <pattern id={patternId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="var(--color-text-secondary)" fillOpacity="0.18" />
            </pattern>

          </defs>

          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} pointerEvents="none" />
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--color-text-secondary)"
            strokeDasharray="4 8"
            strokeOpacity={0.2}
          />
          {latestLabel ? (
            <ReferenceLine
              x={latestLabel}
              stroke="var(--color-primary)"
              strokeDasharray="4 4"
              strokeOpacity={0.45}
            />
          ) : null}
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: compact ? 11 : 12, fontWeight: 600 }}
            tickMargin={12}
            minTickGap={compact ? 12 : 24}
            interval="preserveStartEnd"
          />
          {showYAxis ? (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
              tickFormatter={formatYAxis}
              tickMargin={10}
              width={compact ? 44 : 80}
              domain={[0, 'auto']}
              allowDecimals={false}
            />
          ) : null}
          <Tooltip
            content={<LineTooltip valueLabel={valueLabel} formatValue={formatValue} />}
            cursor={{ stroke: 'var(--color-primary)', strokeDasharray: '3 3', strokeOpacity: 0.45 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke="var(--color-primary)"
            strokeWidth={compact ? 2 : 2.5}
            dot={renderDot}
            activeDot={{
              r: compact ? 5 : 6,
              fill: 'var(--color-primary)',
              stroke: 'var(--color-background-light)',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
