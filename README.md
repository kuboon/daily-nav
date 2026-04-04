# Obsidian Daily Nav Plugin

[Install via BRAT](obsidian://brat?plugin=https://github.com/kuboon/daily-nav)

## Features

This plugin adds two commands to the command palette:

- `Daily Nav: Open Yesterday's Note`
- `Daily Nav: Open Tomorrow's Note`

It is recommended to use with
[Note Toolbar](https://github.com/chrisgurney/obsidian-note-toolbar)

obsidian://note-toolbar?import=%3E%20%5B!note-toolbar%7Cborder-even-sticky-mrght%5D%20daily%0A%3E%20-%20%5B%3ALiCalendarMinus%3A%5D()%3Cdata%20data-ntb-command%3D%22daily-nav%3Aopen-yesterdays-note%22%2F%3E%20%3C!--%20yesterday%20--%3E%0A%3E%20-%20%5B%3ALiCalendarDays%3A%5D()%3Cdata%20data-ntb-command%3D%22daily-notes%22%2F%3E%20%3C!--%20today%20--%3E%0A%3E%20-%20%5B%3ALiCalendarPlus%3A%5D()%3Cdata%20data-ntb-command%3D%22daily-nav%3Aopen-tomorrows-note%22%2F%3E%20%3C!--%20tomorrow%20--%3E%0A

## How it works

This plugin depends on
[obsidian-daily-notes-interface](https://github.com/liamcain/obsidian-daily-notes-interface)
which reads settings from the daily notes plugin and
[periodic notes](https://github.com/liamcain/obsidian-periodic-notes) plugin if
you are using.
