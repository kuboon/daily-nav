import { App, Editor, MarkdownView, Modal, Notice, Plugin, Vault } from 'obsidian';
import { getAllDailyNotes, getDateFromFile } from "obsidian-daily-notes-interface";
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings?: MyPluginSettings;

	override async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-yesterdays-note',
			name: 'Open yesterday\'s note',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile()!;
				const currentDate = getDateFromFile(activeFile, "day")!;
				const allDailyNotes = getAllDailyNotes();
				const dailyNoteKeys = Object.keys(allDailyNotes).sort().reverse();
				const yesterday = dailyNoteKeys.find(key => getDateFromFile(allDailyNotes[key]!, "day")! < currentDate);
				if(yesterday) {
					this.app.workspace.openLinkText(allDailyNotes[yesterday]!.basename, '');
				}
			}
		});
		this.addCommand({
			id: 'open-tomorrows-note',
			name: 'Open tomorrow\'s note',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile()!;
				const currentDate = getDateFromFile(activeFile, "day")!;
				const allDailyNotes = getAllDailyNotes();
				const dailyNoteKeys = Object.keys(allDailyNotes).sort();
				const yesterday = dailyNoteKeys.find(key => getDateFromFile(allDailyNotes[key]!, "day")! > currentDate);
				if(yesterday) {
					this.app.workspace.openLinkText(allDailyNotes[yesterday]!.basename, '');
				}
			}
		});
	}

	override onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
