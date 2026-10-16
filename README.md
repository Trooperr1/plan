# Daily Planner

A complete personal planning app for your day, week and year. It runs in any browser, works offline, can be installed on your phone like an app, and keeps your data private on your device.

## Features

### My Day (daily planner)
- A greeting, today's date and a **Main focus** for the day
- A progress ring, plus counts of tasks left, events, habits and overdue tasks
- A **task list** with priorities, categories, checklists (sub-steps), notes and repeating tasks
- **Quick add** that understands plain text: `Doctor at 4:30pm #health !high`
- A **schedule timeline** of your events and timed tasks, with a red "Now" line
- Habit check-ins, upcoming reminders, daily notes and a mood tracker
- Move to the previous or next day, or jump to any date, to plan ahead

### Calendar
- **Month view** showing events and tasks for each day
- **Week view** with an hourly grid. Overlapping events sit side by side, and clicking an empty slot creates an event at that time
- A day panel that lists everything on the selected day

### Reminders
- Set a reminder on any timed task or event: at start time, 5/10/15/30 min, 1–2 hours, or 1 day before
- Reminders show inside the app with a chime, and as **phone or desktop notifications** if you allow them (Settings → Reminders)
- A missed reminder (one from the last hour) still shows when you reopen the app

### Tasks
- Filters: Today, Next 14 days, Overdue, Someday, All and Completed
- Search, plus category and priority filters
- Undo after deleting

### Habits
- Daily check-ins for the last 7 days, current and best streak, 30-day consistency
- A heatmap of the last 12 weeks for each habit

### Year Timeline (separate page)
- A **Theme / word of the year** and a year progress bar ("Day 289 of 365 · 76 days left")
- **Roadmap (Gantt)**: each yearly goal is a bar across the months, filled to its progress, with milestone diamonds and a "today" line
- Goal cards with a progress slider and a milestone checklist
- **Month by month** cards listing each month's milestones and how many tasks you finished
- **Year in pixels**: 365 squares, each coloured by how much you got done that day
- Look back at past years or plan future ones

### Settings
- Your name, light/dark/automatic theme, first day of the week, 12- or 24-hour time
- Notifications, reminder sound and default reminder time
- Add, rename, recolour or delete categories
- **Export / import a backup** (JSON), add sample data, or erase everything

Keyboard shortcuts: `N` new task · `E` new event · `1`–`6` switch pages · `Esc` close dialog.

## How to use it

**Quickest:** open `index.html` in your browser.

**Recommended (enables offline mode, install and notifications):** serve the folder over HTTP(S):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**Put it online for free with GitHub Pages:** in the repository go to *Settings → Pages* and set Source to *Deploy from a branch*. Pick the branch and the `/ (root)` folder. Your planner will then be live at `https://<your-username>.github.io/<repo>/`. On your phone, open that link and choose **Add to Home screen** (or **Install app**).

## Your data

Everything is saved in your browser's local storage, on that device only. Nothing is uploaded anywhere. To move your planner to another device, or to keep a safe copy, use **Settings → Export backup** and then **Import backup**.

> Note: browsers only deliver reminders while the app is open or installed and running in the background. Keep it open in a tab, or install it, for reminders to arrive on time.

## Project structure

```
index.html            App shell
css/styles.css        All styles (light + dark, responsive)
js/utils.js           Date & string helpers
js/store.js           Saved data, sample data
js/schedule.js        Repeats, completion, streaks
js/reminders.js       Reminder engine + notifications
js/ui.js              Modals, confirms, toasts
js/components.js      Shared task/event markup
js/forms.js           Task, event, habit, goal dialogs
js/views/*.js         Pages: today, calendar, tasks, habits, timeline, settings
js/main.js            Routing, shortcuts, theme, boot
sw.js                 Offline cache + notification clicks
manifest.webmanifest  Install as an app
```

No build step and no dependencies: plain HTML, CSS and JavaScript.
