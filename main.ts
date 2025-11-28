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
          this.app.workspace.openLinkText(yesterdayNote.basename, "");
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
          this.app.workspace.openLinkText(tomorrowNote.basename, "");
        }
      },
    });
    function openSiblingNote(offset: number) {
      const explorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
      const currentPath = app.workspace.getActiveFile().path;
      const filePaths = Object.keys(explorer.view.fileItems);
      const currentIdx = filePaths.indexOf(currentPath);
      const siblingIdx = currentIdx + offset;
      const siblingFilePath = filePaths[siblingIdx];
      if (siblingFilePath) {
        this.app.workspace.getLeaf().openFile(
          this.app.vault.getAbstractFileByPath(siblingFilePath)!,
        );
      }
    }
    this.addCommand({
      id: "open-prev-note",
      name: "Open previous note on explorer view order",
      callback: () => {
        openSiblingNote(-1);
      },
    });
    this.addCommand({
      id: "open-next-note",
      name: "Open next note on explorer view order",
      callback: () => {
        openSiblingNote(1);
      },
    });
  }
}
