import { Plugin } from "obsidian";
import { getAllDailyNotes } from "obsidian-daily-notes-interface";

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
}
