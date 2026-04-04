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
import {
  type CalendarDataSource,
  CalendarRenderer,
  type DayInfo,
} from "./calendar-renderer.ts";

type Moment = moment.Moment;
const m = moment as unknown as (
  ...args: Parameters<typeof moment.utc>
) => Moment;

export const VIEW_TYPE_DAILY_CALENDAR = "daily-calendar-view";

export class DailyCalendarView extends ItemView {
  private renderer!: CalendarRenderer;

  constructor(leaf: WorkspaceLeaf, private pluginApp: App) {
    super(leaf);
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
    const container = this.containerEl.children[1] as HTMLElement;
    container.style.height = "100%";
    container.style.overflow = "hidden";
    const dataSource = new ObsidianDataSource(this.app, () => m());
    this.renderer = new CalendarRenderer(container, dataSource);
    await this.renderer.render();
    this.registerEvent(
      this.app.vault.on("create", () => this.renderer.render()),
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.renderer.render()),
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.renderer.render()),
    );
  }
}

class ObsidianDataSource implements CalendarDataSource {
  constructor(
    private app: App,
    private now: () => Moment,
  ) {}

  async loadRange(
    firstDay: Date,
    lastDay: Date,
  ): Promise<Map<string, DayInfo>> {
    const result = new Map<string, DayInfo>();
    if (!appHasDailyNotesPluginLoaded()) return result;

    const allDailyNotes = getAllDailyNotes();
    const cursor = this.now().clone();
    cursor.year(firstDay.getFullYear()).month(firstDay.getMonth()).date(
      firstDay.getDate(),
    ).startOf("day");
    const end = this.now().clone();
    end.year(lastDay.getFullYear()).month(lastDay.getMonth()).date(
      lastDay.getDate(),
    ).startOf("day");

    while (cursor.isSameOrBefore(end, "day")) {
      const file = getDailyNote(cursor, allDailyNotes);
      if (file) {
        const content = await this.app.vault.cachedRead(file);
        const headingMatch = content.match(/^#\s+(.+)$/m);
        result.set(cursor.format("YYYY-MM-DD"), {
          heading: headingMatch ? headingMatch[1].trim() : "",
          hasUnchecked: /^- \[ \] /m.test(content),
        });
      }
      cursor.add(1, "day");
    }
    return result;
  }

  onDayClick(date: Date): void {
    if (!appHasDailyNotesPluginLoaded()) {
      new Notice(
        "Daily Notes (or Periodic Notes daily setting) is not enabled.",
      );
      return;
    }
    const momentDate = this.toMoment(date);
    const allDailyNotes = getAllDailyNotes();
    const target = getDailyNote(momentDate, allDailyNotes);
    if (target) {
      this.app.workspace.getLeaf(true).openFile(target);
    } else {
      createDailyNote(momentDate).then((file: TFile) => {
        this.app.workspace.getLeaf(true).openFile(file);
      });
    }
  }

  onWeekClick(isoYear: number, isoWeek: number): void {
    const filename = `${isoYear}W${(`0${isoWeek}`).slice(-2)}`;
    const file = this.app.vault.getAbstractFileByPath(`${filename}.md`);
    if (file) {
      this.app.workspace.getLeaf(true).openFile(file as TFile);
    } else {
      this.app.vault.create(`${filename}.md`, "").then((f) => {
        this.app.workspace.getLeaf(true).openFile(f);
      });
    }
  }

  private toMoment(date: Date): Moment {
    const d = this.now();
    return d.year(date.getFullYear()).month(date.getMonth()).date(
      date.getDate(),
    ).startOf("day");
  }
}
