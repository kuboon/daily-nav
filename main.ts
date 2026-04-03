import { Plugin } from "obsidian";
import { getAllDailyNotes } from "obsidian-daily-notes-interface";
import {
  DailyCalendarView,
  VIEW_TYPE_DAILY_CALENDAR,
} from "./ui/daily-calendar-view.ts";

export default class DailyNav extends Plugin {
  prepare() {
    const allDailyNotes = getAllDailyNotes();
    const allKeys = Object.keys(allDailyNotes).sort();
    const activeFile = this.app.workspace.getActiveFile()!;
    const activeNoteIdx = allKeys.findIndex((key) =>
      allDailyNotes[key]!.name === activeFile.name
    )!;
    return { allDailyNotes, allKeys, activeNoteIdx };
  }

  override onload() {
    this.registerView(
      VIEW_TYPE_DAILY_CALENDAR,
      (leaf) => new DailyCalendarView(leaf, this.app),
    );

    this.addCommand({
      id: "open-daily-calendar",
      name: "Open daily calendar panel",
      callback: () => this.activateDailyCalendarView(),
    });

    this.addRibbonIcon("calendar", "Open daily calendar", () => {
      this.activateDailyCalendarView();
    });

    this.addCommand({
      id: "open-yesterdays-note",
      name: "Open yesterday's note",
      callback: () => {
        const { allDailyNotes, allKeys, activeNoteIdx } = this.prepare();
        const yesterdayNote = allDailyNotes[allKeys[activeNoteIdx - 1]];
        if (yesterdayNote) {
          this.app.workspace.getLeaf().openFile(yesterdayNote);
        }
      },
    });
    this.addCommand({
      id: "open-tomorrows-note",
      name: "Open tomorrow's note",
      callback: () => {
        const { allDailyNotes, allKeys, activeNoteIdx } = this.prepare();
        const tomorrowNote = allDailyNotes[allKeys[activeNoteIdx + 1]];
        if (tomorrowNote) {
          this.app.workspace.getLeaf().openFile(tomorrowNote);
        }
      },
    });
  }

  override onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_CALENDAR);
  }

  private async activateDailyCalendarView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_CALENDAR)[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({
        type: VIEW_TYPE_DAILY_CALENDAR,
        active: true,
      });
    }
    await this.app.workspace.revealLeaf(leaf);
  }
}
