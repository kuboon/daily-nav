/** Data for a single day cell */
export interface DayInfo {
  /** Heading text extracted from the note (empty string if none) */
  heading: string;
  /** Whether the note contains unchecked checkboxes */
  hasUnchecked: boolean;
}

/** Abstraction over vault/daily-note operations — implement for Obsidian or browser preview */
export interface CalendarDataSource {
  /** Load day metadata for the visible date range. Resolved map: "YYYY-MM-DD" -> DayInfo */
  loadRange(firstDay: Date, lastDay: Date): Promise<Map<string, DayInfo>>;
  /** Called when a day cell is clicked */
  onDayClick(date: Date): void;
  /** Called when a week number cell is clicked */
  onWeekClick(isoYear: number, isoWeek: number): void;
}

/** Pure-DOM calendar renderer. No Obsidian dependency. */
export class CalendarRenderer {
  private displayDate: Date;
  private container: HTMLElement;
  private dataSource: CalendarDataSource;

  constructor(container: HTMLElement, dataSource: CalendarDataSource, initialDate?: Date) {
    this.container = container;
    this.dataSource = dataSource;
    this.displayDate = initialDate ?? new Date();
  }

  setDisplayDate(date: Date): void {
    this.displayDate = date;
  }

  goToToday(): void {
    this.displayDate = new Date();
  }

  shiftMonth(offset: number): void {
    const d = new Date(this.displayDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    this.displayDate = d;
  }

  async render(): Promise<void> {
    this.container.innerHTML = "";

    const wrapper = el("div", "daily-calendar");
    this.container.appendChild(wrapper);

    this.renderNav(wrapper);

    const prevMonth = monthOffset(this.displayDate, -1);
    const nextMonth = monthOffset(this.displayDate, 1);

    const range = el("div", "daily-calendar-range");
    range.textContent = `${fmt(prevMonth)} ~ ${fmt(nextMonth)}`;
    wrapper.appendChild(range);

    const grid = el("div", "daily-calendar-grid");
    wrapper.appendChild(grid);

    // Header
    grid.appendChild(elText("div", "W", "daily-calendar-weekday daily-calendar-week-header"));
    for (const day of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
      grid.appendChild(elText("div", day, "daily-calendar-weekday"));
    }

    const startOfRange = startOfMonth(prevMonth);
    const endOfRange = endOfMonth(nextMonth);

    const firstDay = weekStart(startOfRange); // Monday
    const lastDay = weekEnd(endOfRange); // Sunday

    const dayInfoMap = await this.dataSource.loadRange(firstDay, lastDay);
    const today = stripTime(new Date());

    const cursor = new Date(firstDay);
    while (cursor <= lastDay) {
      // Week number on Monday
      if (isoWeekday(cursor) === 1) {
        const [isoYear, isoWeek] = isoWeekOfDate(cursor);
        const weekEl = elText("div", `W${isoWeek}`, "daily-calendar-week");
        weekEl.setAttribute("aria-label", `${isoYear}-W${pad2(isoWeek)}`);
        weekEl.addEventListener("click", () => this.dataSource.onWeekClick(isoYear, isoWeek));
        grid.appendChild(weekEl);
      }

      const date = new Date(cursor);
      const key = dateKey(date);
      const isToday = key === dateKey(today);
      const info = dayInfoMap.get(key);
      const hasNote = !!info;

      const classes = ["daily-calendar-day"];
      if (isToday) classes.push("daily-calendar-day-today");
      if (hasNote) classes.push("daily-calendar-day-has-note");
      if (info?.hasUnchecked) classes.push("daily-calendar-day-unchecked");

      const dayEl = el("div", classes.join(" "));
      dayEl.appendChild(elText("div", String(date.getDate()), "daily-calendar-day-num"));

      if (info?.heading) {
        const label = elText("div", info.heading, "daily-calendar-day-label");
        label.title = info.heading;
        dayEl.appendChild(label);
      }

      dayEl.addEventListener("click", () => this.dataSource.onDayClick(date));
      dayEl.setAttribute("aria-label", key);
      dayEl.setAttribute("tabindex", "0");
      dayEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.dataSource.onDayClick(date);
        }
      });

      grid.appendChild(dayEl);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  private renderNav(wrapper: HTMLElement): void {
    const header = el("div", "daily-calendar-header");
    wrapper.appendChild(header);

    const prevBtn = elText("button", "\u2039", "daily-calendar-nav");
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.addEventListener("click", () => { this.shiftMonth(-1); this.render(); });
    header.appendChild(prevBtn);

    const titleGroup = el("div", "daily-calendar-title-group");
    const todayBtn = elText("button", "Today", "daily-calendar-today");
    todayBtn.setAttribute("aria-label", "Go to today");
    todayBtn.addEventListener("click", () => { this.goToToday(); this.render(); });
    titleGroup.appendChild(todayBtn);
    header.appendChild(titleGroup);

    const nextBtn = elText("button", "\u203A", "daily-calendar-nav");
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.addEventListener("click", () => { this.shiftMonth(1); this.render(); });
    header.appendChild(nextBtn);
  }
}

// ── Date helpers (no moment dependency) ──

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function elText(tag: string, text: string, cls: string): HTMLElement {
  const e = el(tag, cls);
  e.textContent = text;
  return e;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return (`0${n}`).slice(-2);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthOffset(d: Date, offset: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Monday of the week containing d (ISO: Mon=1) */
function weekStart(d: Date): Date {
  const r = new Date(d);
  const day = isoWeekday(r);
  r.setDate(r.getDate() - (day - 1));
  return r;
}

/** Sunday of the week containing d */
function weekEnd(d: Date): Date {
  const r = new Date(d);
  const day = isoWeekday(r);
  r.setDate(r.getDate() + (7 - day));
  return r;
}

/** 1=Mon .. 7=Sun */
function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Returns [isoYear, isoWeek] */
function isoWeekOfDate(d: Date): [number, number] {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1)
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return [tmp.getUTCFullYear(), weekNo];
}
