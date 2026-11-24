import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DateScope } from './SearchFilterBar.tsx';

interface CalendarDateFilterProps {
  id?: string;
  dateScope: DateScope;
  selectedDate: string; // YYYY-MM-DD or ''
  availableDateKeys: Set<string>; // YYYY-MM-DD keys that contain coupons
  onSelectAllDates: () => void;
  onSelectToday: () => void;
  onSelectSpecificDate: (dateKey: string) => void;
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function toLocalDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseLocalDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateKeyShort(dateKey: string): string {
  const d = parseLocalDateKey(dateKey);
  if (!d) return dateKey;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function CalendarDateFilter({
  id = 'filter-tanggal',
  dateScope,
  selectedDate,
  availableDateKeys,
  onSelectAllDates,
  onSelectToday,
  onSelectSpecificDate,
}: CalendarDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const todayKey = toLocalDateKey(new Date());

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const base = parseLocalDateKey(selectedDate) ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    if (!isOpen) return;
    const base =
      dateScope === 'TANGGAL_TERTENTU' && selectedDate
        ? parseLocalDateKey(selectedDate) ?? new Date()
        : new Date();
    setViewMonth({ year: base.getFullYear(), month: base.getMonth() });
  }, [isOpen, dateScope, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();

    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = toLocalDateKey(new Date(viewMonth.year, viewMonth.month, day));
      cells.push({ day, dateKey });
    }
    return cells;
  }, [viewMonth.year, viewMonth.month]);

  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(viewMonth.year, viewMonth.month, 1));

  const goPrevMonth = () => {
    setViewMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 },
    );
  };

  const goNextMonth = () => {
    setViewMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 },
    );
  };

  const activeLabel =
    dateScope === 'HARI_INI'
      ? `Hari Ini (${formatDateKeyShort(todayKey)})`
      : dateScope === 'TANGGAL_TERTENTU' && selectedDate
        ? formatDateKeyShort(selectedDate)
        : 'Semua Tanggal';

  const activeSelectedKey =
    dateScope === 'HARI_INI'
      ? todayKey
      : dateScope === 'TANGGAL_TERTENTU'
        ? selectedDate
        : '';

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="neu-inset-sm h-10 px-3 rounded-xl inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-mono tabular-nums">{activeLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {dateScope !== 'SEMUA_TANGGAL' ? (
          <button
            type="button"
            onClick={() => {
              onSelectAllDates();
              setIsOpen(false);
            }}
            aria-label="Reset filter tanggal ke Semua Tanggal"
            title="Tampilkan Semua Tanggal"
            className="neu-btn h-10 w-10 rounded-xl inline-flex items-center justify-center text-slate-500 hover:text-slate-800 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Kalender pilih tanggal kupon"
          className="neu-raised absolute right-0 mt-2.5 z-40 w-[300px] sm:w-[320px] rounded-2xl p-4 space-y-3.5"
        >
          {/* Quick Period Switch */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectAllDates();
                setIsOpen(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateScope === 'SEMUA_TANGGAL'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'neu-btn text-slate-700 hover:text-slate-900'
              }`}
            >
              Semua Tanggal
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectToday();
                setIsOpen(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateScope === 'HARI_INI'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'neu-btn text-slate-700 hover:text-slate-900'
              }`}
            >
              Hari Ini Saja
            </button>
          </div>

          {/* Direct Specific Date Input */}
          <div className="space-y-1">
            <label htmlFor="direct-date-input" className="block text-[11px] font-bold text-slate-600">
              Pilih Tanggal Tertentu:
            </label>
            <input
              id="direct-date-input"
              type="date"
              value={activeSelectedKey}
              onChange={(e) => {
                const next = e.target.value;
                if (!next) {
                  onSelectAllDates();
                  return;
                }
                onSelectSpecificDate(next);
                const parsed = parseLocalDateKey(next);
                if (parsed) {
                  setViewMonth({ year: parsed.getFullYear(), month: parsed.getMonth() });
                }
              }}
              className="neu-inset-sm w-full h-9 px-3 rounded-xl font-mono tabular-nums text-xs font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
            />
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Bulan sebelumnya"
              className="neu-btn w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-900 capitalize">{monthLabel}</span>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Bulan berikutnya"
              className="neu-btn w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="neu-inset rounded-xl p-2.5">
            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {WEEKDAYS.map((dayName) => (
                <div
                  key={dayName}
                  className="text-center text-[11px] font-bold text-slate-500 py-1"
                >
                  {dayName}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, idx) => {
                if (!cell.day || !cell.dateKey) {
                  return <div key={`empty-${idx}`} className="h-9" />;
                }

                const isSelected = activeSelectedKey === cell.dateKey;
                const isToday = cell.dateKey === todayKey;
                const hasData = availableDateKeys.has(cell.dateKey);

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => {
                      onSelectSpecificDate(cell.dateKey!);
                      setIsOpen(false);
                    }}
                    className={`relative h-9 rounded-lg font-mono tabular-nums text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 text-white font-bold shadow-xs'
                        : isToday
                          ? 'bg-emerald-100/90 text-emerald-900 font-bold ring-1 ring-emerald-500/60'
                          : 'text-slate-800 hover:bg-white/75'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {hasData ? (
                      <span
                        aria-hidden="true"
                        className={`w-3.5 h-0.5 rounded-full mt-0.5 ${
                          isSelected ? 'bg-emerald-200' : 'bg-emerald-600'
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Garis hijau menandakan tanggal yang memiliki data kupon.
          </p>
        </div>
      ) : null}
    </div>
  );
}
