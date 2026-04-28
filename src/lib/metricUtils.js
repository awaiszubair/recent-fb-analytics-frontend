/**
 * metricUtils.js
 *
 * ── Meta end_time convention ──────────────────────────────────────────────────
 * The Meta Insights API stores one data point per day where:
 *
 *   end_time = "<performance_day + 1>T00:00:00+0000"
 *
 * Example — requesting since=2026-03-30 / until=2026-04-05 returns:
 *   { end_time: "2026-03-31T00:00:00+0000", value: X }  ← perf of Mar 30
 *   { end_time: "2026-04-01T00:00:00+0000", value: X }  ← perf of Apr 01
 *   ...
 *   { end_time: "2026-04-06T00:00:00+0000", value: X }  ← perf of Apr 05
 *
 * The backend DB stores end_time exactly as Meta returns it (D+1) and queries
 * with date boundaries shifted by +1 day to match. The frontend helpers below
 * honour the same convention:
 *
 *   Valid point: end_time_dateStr  >  sinceStr   (excludes the ghost D-1 point)
 *               end_time_dateStr  <= untilPlusOne (includes the D+1 point for `until` day)
 *
 * Where untilPlusOne = formatDate(until + 1 day).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Format a Date as YYYY-MM-DD */
const toDateStr = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

const earningsMetrics = new Set([
  'content_monetization_earnings',
  'monetization_approximate_earnings',
]);

const parseDecimalLike = (value) => {
  if (!value || typeof value !== 'object' || !Array.isArray(value.d) || typeof value.e !== 'number') {
    return null;
  }

  const chunks = value.d.map((chunk, index) => {
    const chunkString = String(Math.trunc(Number(chunk) || 0));
    return index === 0 ? chunkString : chunkString.padStart(7, '0');
  });

  const digits = chunks.join('');
  const decimalIndex = value.e + 1;
  let normalized = digits;

  if (decimalIndex <= 0) {
    normalized = `0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`;
  } else if (decimalIndex < digits.length) {
    normalized = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  } else if (decimalIndex > digits.length) {
    normalized = `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }

  const sign = value.s === -1 ? '-' : '';
  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumericLike = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const decimalLike = parseDecimalLike(value);
  if (decimalLike !== null) {
    return decimalLike;
  }

  return 0;
};

const normalizeMetricValue = (metricName, value) => {
  if (earningsMetrics.has(metricName) && value && typeof value === 'object') {
    const microAmount = parseNumericLike(value.microAmount);
    return Number.isFinite(microAmount) ? microAmount / 1_000_000 : 0;
  }

  return value;
};

/**
 * Given a YYYY-MM-DD string, return the string for the next calendar day.
 */
const nextDay = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateStr(d);
};

/**
 * Returns true if an end_time data point falls within the requested [sinceStr .. untilStr] window.
 */
const isInRange = (endTime, sinceStr, untilStr) => {
  if (!endTime) return true; // keep lifetime / null end_time aggregates
  const dayStr = endTime.substring(0, 10);
  return dayStr > sinceStr && dayStr <= nextDay(untilStr);
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Sum a named metric across all data points that fall inside the requested
 * date window (using Meta's D+1 end_time convention).
 */
export const getMetricTotal = (insightsData, metricName, sinceStr, untilStr) => {
  const metric = insightsData?.data?.find((m) => m.name === metricName);
  if (!metric || !Array.isArray(metric.values)) return 0;

  // Deduplication: collapse identical (end_time, value) pairs that can appear
  // when overlapping cache windows are merged.
  const uniqueMap = new Map();
  metric.values.forEach((v) => {
    const key = `${v.end_time || 'lifetime'}::${JSON.stringify(v.value)}`;
    uniqueMap.set(key, v);
  });

  let values = Array.from(uniqueMap.values());

  // Apply date-range filter (respects Meta's D+1 end_time convention)
  if (sinceStr && untilStr) {
    values = values.filter((v) => isInRange(v.end_time, sinceStr, untilStr));
  }

  return values.reduce((sum, v) => {
    const val = normalizeMetricValue(metricName, v?.value);
    if (typeof val === 'number') return sum + val;
    if (typeof val === 'object' && val !== null) {
      return sum + Object.values(val).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    }
    return sum;
  }, 0);
};

/**
 * Return an ordered time-series array for a named metric within the
 * requested date window (uses the same D+1 boundary logic as getMetricTotal).
 */
export const getMetricTimeSeries = (insightsData, metricName, sinceStr, untilStr) => {
  const metric = insightsData?.data?.find((m) => m.name === metricName);
  if (!metric || !Array.isArray(metric.values)) return [];

  const uniqueMap = new Map();
  metric.values.forEach((v) => {
    const key = `${v.end_time || 'null'}::${JSON.stringify(v.value)}`;
    uniqueMap.set(key, v);
  });

  let values = Array.from(uniqueMap.values());

  if (sinceStr && untilStr) {
    values = values.filter((v) => {
      if (!v.end_time) return false; // exclude null-end_time rows from charts
      return isInRange(v.end_time, sinceStr, untilStr);
    });
  }

  return values
    .sort((a, b) => (a.end_time || '').localeCompare(b.end_time || ''))
    .map((v) => ({
      date: v.end_time,
      value: (() => {
        const normalized = normalizeMetricValue(metricName, v.value);
        return typeof normalized === 'number' ? normalized : 0;
      })(),
    }));
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

export const formatNumber = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

export const formatCurrency = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '--';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Calculate percentage change from previous to current.
 * Returns null if previous is 0 or null (cannot divide by zero).
 */
export const calculatePercentChange = (current, previous) => {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10; // 1 decimal
};

/** Format a percent change for display, e.g. +18.2% or -4.1% */
export const formatPercent = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};
