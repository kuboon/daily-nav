import {
  App,
  ItemView,
  moment,
  Notice,
  type TFile,
  WorkspaceLeaf,
} from "obsidian";
import {
  appHasDailyNotesPluginLoaded,
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";

type Moment = moment.Moment;
const m = moment as unknown as (
  ...args: Parameters<typeof moment.utc>
) => Moment;

export const VIEW_TYPE_DAILY_CALENDAR = "daily-calendar-view";

export class DailyCalendarView extends ItemView {
  private displayDate: Moment;
  private dailyNotes: Record<string, TFile> = {};
  private headingCache: Map<string, string> = new Map();
  private uncheckedSet: Set<string> = new Set();

  constructor(leaf: WorkspaceLeaf, private pluginApp: App) {
    super(leaf);
    this.displayDate = m();
  }

  getViewType(): string {
    return VIEW_TYPE_DAILY_CALENDAR;
  }

  getDisplayText(): string {
    return "Daily Calendar";
  }

  override getIcon(): string {
    return "calendar";
  }

  override async onOpen(): Promise<void> {
    await Promise.resolve();
    this.refreshDailyNotes();
    this.render();
    this.registerEvent(
      this.app.vault.on("create", () => this.onVaultChange()),
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.onVaultChange()),
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.onVaultChange()),
    );
  }

  private onVaultChange(): void {
    this.refreshDailyNotes();
    this.render();
  }

  private refreshDailyNotes(): void {
    if (appHasDailyNotesPluginLoaded()) {
      this.dailyNotes = getAllDailyNotes();
    }
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "daily-calendar" });

    this.renderNav(wrapper);

    const prevMonth = this.displayDate.clone().subtract(1, "month");
    const nextMonth = this.displayDate.clone().add(1, "month");

    wrapper.createDiv({
      cls: "daily-calendar-range",
      text: `${prevMonth.format("YYYY-MM")} ~ ${nextMonth.format("YYYY-MM")}`,
    });

    const grid = wrapper.createDiv({ cls: "daily-calendar-grid" });

    // Header row: week column + 7 weekdays
    grid.createDiv({
      cls: "daily-calendar-weekday daily-calendar-week-header",
      text: "W",
    });
    const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    for (const day of weekdays) {
      grid.createDiv({ cls: "daily-calendar-weekday", text: day });
    }

    const startOfRange = prevMonth.clone().startOf("month");
    const endOfRange = nextMonth.clone().endOf("month");

    const leadingDays = startOfRange.isoWeekday() - 1;
    const firstDay = startOfRange.clone().subtract(leadingDays, "days");

    const trailingDays = 7 - endOfRange.isoWeekday();
    const lastDay = endOfRange.clone().add(trailingDays, "days");

    await this.loadNoteMetadata(firstDay, lastDay);

    const today = m();
    const cursor = firstDay.clone();
    while (cursor.isSameOrBefore(lastDay, "day")) {
      // Insert ISO week number at the start of each week (Monday)
      if (cursor.isoWeekday() === 1) {
        const isoWeek = cursor.isoWeek();
        const isoYear = cursor.isoWeekYear();
        const weekLabel = `W${isoWeek}`;
        const weekEl = grid.createDiv({
          cls: "daily-calendar-week",
          text: weekLabel,
        });
        weekEl.setAttribute(
          "aria-label",
          `${isoYear}-W${(`0${isoWeek}`).slice(-2)}`,
        );
        weekEl.addEventListener(
          "click",
          () => this.onWeekClick(isoYear, isoWeek),
        );
      }

      const date = cursor.clone();
      const isToday = date.isSame(today, "day");
      const noteFile = getDailyNote(date, this.dailyNotes);

      const classes = ["daily-calendar-day"];
      if (isToday) classes.push("daily-calendar-day-today");
      if (noteFile) classes.push("daily-calendar-day-has-note");
      if (noteFile && this.uncheckedSet.has(noteFile.path)) {
        classes.push("daily-calendar-day-unchecked");
      }

      const dayEl = grid.createDiv({ cls: classes.join(" ") });
      dayEl.createDiv({
        cls: "daily-calendar-day-num",
        text: String(date.date()),
      });

      if (noteFile) {
        const heading = this.headingCache.get(noteFile.path) ?? "";
        if (heading) {
          dayEl.createDiv({
            cls: "daily-calendar-day-label",
            text: heading,
            attr: { title: heading },
          });
        }
      }

      dayEl.addEventListener("click", () => this.onDayClick(date));
      dayEl.setAttribute("aria-label", date.format("YYYY-MM-DD"));
      dayEl.setAttribute("tabindex", "0");
      dayEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.onDayClick(date);
        }
      });

      cursor.add(1, "day");
    }
  }

  private renderNav(wrapper: HTMLElement): void {
    const header = wrapper.createDiv({ cls: "daily-calendar-header" });

    const prevBtn = header.createEl("button", {
      cls: "daily-calendar-nav",
      text: "\u2039",
      attr: { "aria-label": "Previous month" },
    });
    prevBtn.addEventListener("click", () => {
      this.displayDate = this.displayDate.clone().subtract(1, "month");
      this.render();
    });

    const titleContainer = header.createDiv({
      cls: "daily-calendar-title-group",
    });
    const todayBtn = titleContainer.createEl("button", {
      cls: "daily-calendar-today",
      text: "Today",
      attr: { "aria-label": "Go to today" },
    });
    todayBtn.addEventListener("click", () => {
      this.displayDate = m();
      this.render();
    });

    const nextBtn = header.createEl("button", {
      cls: "daily-calendar-nav",
      text: "\u203A",
      attr: { "aria-label": "Next month" },
    });
    nextBtn.addEventListener("click", () => {
      this.displayDate = this.displayDate.clone().add(1, "month");
      this.render();
    });
  }

  private async loadNoteMetadata(from: Moment, to: Moment): Promise<void> {
    this.headingCache.clear();
    this.uncheckedSet.clear();
    const cursor = from.clone();
    while (cursor.isSameOrBefore(to, "day")) {
      const file = getDailyNote(cursor, this.dailyNotes);
      if (file && !this.headingCache.has(file.path)) {
        const content = await this.app.vault.cachedRead(file);
        const heading = content.match(/^#\s+(.+)$/m);
        if (heading) {
          this.headingCache.set(file.path, heading[1].trim());
        }
        if (/^- \[ \] /m.test(content)) {
          this.uncheckedSet.add(file.path);
        }
      }
      cursor.add(1, "day");
    }
  }

  private async onWeekClick(isoYear: number, isoWeek: number): Promise<void> {
    const filename = `${isoYear}W${(`0${isoWeek}`).slice(-2)}`;
    const file = this.app.vault.getAbstractFileByPath(`${filename}.md`);
    if (file) {
      await this.app.workspace.getLeaf(true).openFile(file as TFile);
    } else {
      await this.app.workspace.getLeaf(true).openFile(
        await this.app.vault.create(`${filename}.md`, ""),
      );
    }
  }

  private async onDayClick(date: moment.Moment): Promise<void> {
    if (!appHasDailyNotesPluginLoaded()) {
      new Notice(
        "Daily Notes (or Periodic Notes daily setting) is not enabled.",
      );
      return;
    }

    const allDailyNotes = getAllDailyNotes();
    const target = getDailyNote(date, allDailyNotes);
    const file = target ?? (await createDailyNote(date));
    await this.app.workspace.getLeaf(true).openFile(file);

    this.refreshDailyNotes();
    this.render();
  }
}
