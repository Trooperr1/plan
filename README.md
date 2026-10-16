# Daily Planner

A complete personal planning app for your day, week and year. It runs in any browser, works offline, can be installed on your phone like an app, and keeps your data private on your device.

## Features

The planner starts empty, so everything in it is yours.

- **My Day**: today's tasks and schedule. Type a task and press **Add**. Use the arrows to plan tomorrow or any other day.
- **Calendar**: month and week views. Tap a day to see or add its tasks and events.
- **Reminders**: give a task or event a time and pick a reminder (at the start time, minutes or hours before, or 1 day before). It rings inside the app, and on your phone or computer if you turn on notifications in Settings.
- **Tasks**: Today, Upcoming, All and Done, with search.
- **Goals**: choose a year (for example **2028**), add a goal such as *Build my garage*, and list the steps to get there. Each goal shows its progress and appears on a 12-month view of that year.
- **Habits** (optional): turn it on in Settings → Extra pages.
- **Settings**: your name, theme, time format, reminders, and backup / restore.

- **Add to phone calendar**: on any task, event or goal, so your phone's own calendar rings even when this app is closed.
- **Tasks linked to goals**: a task like *Buy bricks* belongs to *Build my garage*. A goal's % fills by itself as you tick off its steps, and it shows how many days are left.
- **Money target**: set how much a goal costs, add what you save, and see what's left.
- **Evening plan**: after 6 PM, My Day offers to move unfinished tasks to tomorrow. Overdue tasks can be moved to today in one tap.
- **Data safety**: the app asks the browser to keep your data, reminds you to download a backup every 14 days, and shows how to install it on your phone.

Every task, event and goal form shows only the main fields. Tap **More options** for priority, category, checklist, location and notes.

## How to use it

**Quickest:** open `index.html` in your browser.

**Recommended (enables offline mode, install and notifications):** serve the folder over HTTP(S):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**Put it online for free with GitHub Pages:** in the repository go to *Settings → Pages* and set Source to *Deploy from a branch*. Pick the branch and the `/ (root)` folder. Your planner will then be live at `https://<your-username>.github.io/<repo>/`. On your phone, open that link and choose **Add to Home screen** (or **Install app**).

## Your data

Everything is saved in your browser's local storage, on that device only. Nothing is uploaded anywhere. To move your planner to another device, or to keep a safe copy, use **Settings → Download backup** and then **Restore backup**.

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
js/views/*.js         Pages: today, calendar, tasks, goals, habits, settings
js/main.js            Routing, shortcuts, theme, boot
sw.js                 Offline cache + notification clicks
manifest.webmanifest  Install as an app
```

No build step and no dependencies: plain HTML, CSS and JavaScript.
