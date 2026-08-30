/**
 * How much of the plan is used (RN-SUB-021).
 *
 * The number it shows is the one the counter has, which the backend maintains
 * outside the write path and is therefore a moment behind. That is fine here
 * and would not be on a receipt: this bar exists to tell someone they are
 * running out of room, and "almost full" survives being a few notes stale.
 */

import { useTranslation } from 'react-i18next';

/** Above this share of the plan, the bar stops being neutral and warns. */
const WARN_AT = 0.8;
/** And above this it is no longer a warning, it is the wall. */
const FULL_AT = 1;

/**
 * Bytes as a person reads them, in the units the plan is sold in. The unit is
 * chosen by size and the locale decides the decimal mark, so 1,5 GB reads
 * right in pt-BR and 1.5 GB in en-US.
 */
export function formatBytes(bytes: number, locale: string): string {
  // The divisor is declared and NOT derived from `limit`: the last band has no
  // upper bound, and dividing by Infinity turned every gigabyte into "0 GB".
  const units: { limit: number; divisor: number; unit: string; digits: number }[] = [
    { limit: 1024, divisor: 1, unit: 'byte', digits: 0 },
    { limit: 1024 ** 2, divisor: 1024, unit: 'kilobyte', digits: 0 },
    {
      limit: 1024 ** 3,
      divisor: 1024 ** 2,
      unit: 'megabyte',
      digits: bytes >= 1024 ** 2 * 10 ? 0 : 1,
    },
    { limit: Infinity, divisor: 1024 ** 3, unit: 'gigabyte', digits: 1 },
  ];
  const scale = units.find((each) => bytes < each.limit) ?? units[units.length - 1]!;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: scale.unit,
    unitDisplay: 'short',
    maximumFractionDigits: scale.digits,
  }).format(bytes / scale.divisor);
}

export function StorageBar({ usedBytes, quotaBytes }: { usedBytes: number; quotaBytes: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt_BR' ? 'pt-BR' : 'en-US';
  const share = quotaBytes > 0 ? usedBytes / quotaBytes : 0;
  const level = share >= FULL_AT ? 'full' : share >= WARN_AT ? 'warn' : 'ok';

  return (
    <div className="storage-bar" data-level={level}>
      <span className="storage-bar-numbers">
        {t('auth.storageUsed', {
          used: formatBytes(usedBytes, locale),
          quota: formatBytes(quotaBytes, locale),
        })}
      </span>
      {/*
        The track is decoration; the numbers above are the accessible answer,
        so the bar itself is hidden from assistive technology rather than read
        out twice in a less useful form.
      */}
      <span className="storage-bar-track" aria-hidden="true">
        <span className="storage-bar-fill" style={{ width: `${Math.min(share, 1) * 100}%` }} />
      </span>
    </div>
  );
}
