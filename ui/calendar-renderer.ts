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

/**
 * Pure-DOM calendar renderer with infinite vertical scroll.
 * Renders 3x the viewport height of week rows; on scrollend,
 * re-centers the grid around the new position.
 */
export class CalendarRenderer {
  /** Monday of the center week */
  private centerDate: Date;
  private container: HTMLElement;
  private dataSource: CalendarDataSource;

  private viewport: HTMLElement | null = null;
  private grid: HTMLElement | null = null;
  private rangeEl: HTMLElement | null = null;
  private rowHeight = 0;
  private visibleWeeks = 0;
  private rendering = false;

  constructor(
    container: HTMLElement,
    dataSource: CalendarDataSource,
    initialDate?: Date,
  ) {
    this.container = container;
    this.dataSource = dataSource;
    // Snap to Monday of the week containing initialDate
    this.centerDate = weekStart(initialDate ?? new Date());
  }

  /** Jump to today and re-render */
  goToToday(): void {
    this.centerDate = weekStart(new Date());
    this.renderGrid();
  }

  /** Shift center by N weeks and re-render */
  shiftWeeks(n: number): void {
    this.centerDate = addDays(this.centerDate, n * 7);
    this.renderGrid();
  }

  /** Initial full render — call once */
  async render(): Promise<void> {
    this.container.innerHTML = "";

    const wrapper = el("div", "daily-calendar");
    this.container.appendChild(wrapper);

    // Nav
    this.renderNav(wrapper);

    // Range label
    this.rangeEl = el("div", "daily-calendar-range");
    wrapper.appendChild(this.rangeEl);

    // Scrollable viewport fills remaining height
    this.viewport = el("div", "daily-calendar-viewport");
    wrapper.appendChild(this.viewport);

    // Grid inside viewport
    this.grid = el("div", "daily-calendar-grid");
    this.viewport.appendChild(this.grid);

    // Sticky header row
    this.grid.appendChild(
      elText("div", "W", "daily-calendar-weekday daily-calendar-week-header"),
    );
    for (const day of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
      this.grid.appendChild(elText("div", day, "daily-calendar-weekday"));
    }

    // First render to measure row height
    await this.buildWeeks(20); // render 20 weeks to measure
    await frame();
    this.measureRow();

    // Now re-render with correct 3x buffer
    await this.renderGrid();

    // Scroll events
    this.viewport.addEventListener("scrollend", () => this.onScrollEnd());
  }

  // ── Internal ──

  private measureRow(): void {
    if (!this.viewport || !this.grid) return;
    // Find first week cell to measure row height
    const weekCell = this.grid.querySelector(".daily-calendar-week") as
      | HTMLElement
      | null;
    if (!weekCell) return;
    // Row height = height of 8-cell grid row (week + 7 days)
    // Measure from one week cell to the next
    const allWeekCells = this.grid.querySelectorAll(".daily-calendar-week");
    if (allWeekCells.length >= 2) {
      const first =
        (allWeekCells[0] as HTMLElement).getBoundingClientRect().top;
      const second =
        (allWeekCells[1] as HTMLElement).getBoundingClientRect().top;
      this.rowHeight = second - first;
    } else {
      // Fallback: use cell offsetHeight + gap
      this.rowHeight = weekCell.offsetHeight + 1;
    }
    if (this.rowHeight <= 0) this.rowHeight = 34; // safety fallback
    this.visibleWeeks = Math.max(
      4,
      Math.ceil(this.viewport.clientHeight / this.rowHeight),
    );
  }

  private async renderGrid(): Promise<void> {
    if (!this.grid || !this.viewport) return;
    if (this.rendering) return;
    this.rendering = true;

    // Clear day cells but keep sticky header (first 8 children)
    while (this.grid.children.length > 8) {
      this.grid.removeChild(this.grid.lastChild!);
    }

    const totalWeeks = this.visibleWeeks * 3;
    const halfWeeks = Math.floor(totalWeeks / 2);

    await this.buildWeeks(totalWeeks);
    await frame();

    // Update range label (visible portion only)
    const visibleHalf = Math.floor(this.visibleWeeks / 2);
    const visibleFirst = addDays(this.centerDate, -visibleHalf * 7);
    const visibleLast = addDays(
      this.centerDate,
      (this.visibleWeeks - visibleHalf) * 7 - 1,
    );
    if (this.rangeEl) {
      this.rangeEl.textContent = `${fmt(visibleFirst)} ~ ${fmt(visibleLast)}`;
    }

    // Center scroll: the center week should be in the middle of viewport
    const headerHeight = (this.grid.children[0] as HTMLElement).offsetHeight;
    this.viewport.scrollTop = halfWeeks * this.rowHeight + headerHeight -
      this.viewport.clientHeight / 2 +
      this.rowHeight / 2;

    this.rendering = false;
  }

  private async buildWeeks(totalWeeks: number): Promise<void> {
    if (!this.grid) return;
    const halfWeeks = Math.floor(totalWeeks / 2);
    const firstMonday = addDays(this.centerDate, -halfWeeks * 7);
    const lastSunday = addDays(firstMonday, totalWeeks * 7 - 1);

    const dayInfoMap = await this.dataSource.loadRange(firstMonday, lastSunday);
    const todayKey = dateKey(stripTime(new Date()));

    // Track month boundaries: weekIndex where the 1st appears
    const monthMarkers: { weekIndex: number; month: number; isOdd: boolean }[] =
      [];

    const cursor = new Date(firstMonday);
    for (let w = 0; w < totalWeeks; w++) {
      // Week number cell
      const [isoYear, isoWeek] = isoWeekOfDate(cursor);
      const weekEl = elText("div", `W${isoWeek}`, "daily-calendar-week");
      weekEl.setAttribute("aria-label", `${isoYear}-W${pad2(isoWeek)}`);
      weekEl.addEventListener(
        "click",
        () => this.dataSource.onWeekClick(isoYear, isoWeek),
      );
      this.grid.appendChild(weekEl);

      // 7 day cells
      for (let d = 0; d < 7; d++) {
        const date = new Date(cursor);
        const key = dateKey(date);
        const isToday = key === todayKey;
        const info = dayInfoMap.get(key);

        const classes = ["daily-calendar-day"];
        if (isToday) classes.push("daily-calendar-day-today");
        if (info) classes.push("daily-calendar-day-has-note");
        if (info?.hasUnchecked) classes.push("daily-calendar-day-unchecked");

        const dayEl = el("div", classes.join(" "));
        dayEl.appendChild(
          elText("div", String(date.getDate()), "daily-calendar-day-num"),
        );

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

        this.grid.appendChild(dayEl);

        if (date.getDate() === 1) {
          monthMarkers.push({
            weekIndex: w,
            month: date.getMonth() + 1,
            isOdd: date.getMonth() % 2 === 1,
          });
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Add month overlays — positioned absolutely within the grid
    // Wait for layout so we can measure cell positions
    await frame();
    // Find the first day cell in each week row to get positions
    const weekCells = this.grid.querySelectorAll(".daily-calendar-week");
    const dayCells = this.grid.querySelectorAll(".daily-calendar-day");
    const gridRect = this.grid.getBoundingClientRect();

    for (const marker of monthMarkers) {
      const weekCell = weekCells[marker.weekIndex] as HTMLElement | undefined;
      if (!weekCell) continue;

      // Left edge: first day cell of this week (right after week cell)
      const firstDayIdx = marker.weekIndex * 7;
      const firstDayCell = dayCells[firstDayIdx] as HTMLElement | undefined;
      if (!firstDayCell) continue;

      const top = weekCell.getBoundingClientRect().top - gridRect.top;
      const left = firstDayCell.getBoundingClientRect().left - gridRect.left;
      const right = gridRect.right - gridRect.left;
      const height = this.rowHeight * 4;

      const cls = marker.isOdd
        ? "daily-calendar-month-overlay daily-calendar-month-overlay-odd"
        : "daily-calendar-month-overlay daily-calendar-month-overlay-even";
      const overlay = el("div", cls);
      overlay.style.top = `${top}px`;
      overlay.style.left = `${left}px`;
      overlay.style.width = `${right - left}px`;
      overlay.style.height = `${height}px`;
      const num = elText(
        "span",
        String(marker.month),
        "daily-calendar-month-overlay-num",
      );
      overlay.appendChild(num);
      this.grid.appendChild(overlay);
    }
  }

  private onScrollEnd(): void {
    if (!this.viewport || !this.grid || this.rendering) return;
    if (this.rowHeight <= 0) return;

    const totalWeeks = this.visibleWeeks * 3;
    const halfWeeks = Math.floor(totalWeeks / 2);
    const headerHeight = (this.grid.children[0] as HTMLElement).offsetHeight;

    // Current center of viewport in scroll coordinates
    const viewportCenter = this.viewport.scrollTop +
      this.viewport.clientHeight / 2;
    // Expected center (the center week row)
    const expectedCenter = halfWeeks * this.rowHeight + headerHeight +
      this.rowHeight / 2;

    const weeksMoved = Math.round(
      (viewportCenter - expectedCenter) / this.rowHeight,
    );
    if (weeksMoved === 0) return;

    this.centerDate = addDays(this.centerDate, weeksMoved * 7);
    this.renderGrid();
  }

  private renderNav(wrapper: HTMLElement): void {
    const header = el("div", "daily-calendar-header");
    wrapper.appendChild(header);

    const prevBtn = elText("button", "\u2039", "daily-calendar-nav");
    prevBtn.setAttribute("aria-label", "Previous month");
    prevBtn.addEventListener("click", () => this.shiftWeeks(-4));
    header.appendChild(prevBtn);

    const titleGroup = el("div", "daily-calendar-title-group");
    const todayBtn = elText("button", "Today", "daily-calendar-today");
    todayBtn.setAttribute("aria-label", "Go to today");
    todayBtn.addEventListener("click", () => this.goToToday());
    titleGroup.appendChild(todayBtn);
    header.appendChild(titleGroup);

    const nextBtn = elText("button", "\u203A", "daily-calendar-nav");
    nextBtn.setAttribute("aria-label", "Next month");
    nextBtn.addEventListener("click", () => this.shiftWeeks(4));
    header.appendChild(nextBtn);
  }
}

// ── Date helpers (no moment dependency) ──

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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

/** Monday of the week containing d (ISO: Mon=1) */
function weekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = isoWeekday(r);
  r.setDate(r.getDate() - (day - 1));
  return r;
}

/** 1=Mon .. 7=Sun */
function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Returns [isoYear, isoWeek] */
function isoWeekOfDate(d: Date): [number, number] {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    (((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7,
  );
  return [tmp.getUTCFullYear(), weekNo];
}
