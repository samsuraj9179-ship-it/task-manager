const API_URL = "https://task-manager-wrld.onrender.com";
let allTasks = [];
let countdownInterval = null;
let reminderTimeouts = [];
let audioCtx = null;
let activeFilter = 'all';
let currentSoundTheme = localStorage.getItem('sound_theme') || 'chime';
let subtaskDrafts = []; // array of strings for draft subtasks in input card

// ── Audio Context & Sound Themes ───────────────────────────────────────────
function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function changeSoundTheme(theme) {
    currentSoundTheme = theme;
    localStorage.setItem('sound_theme', theme);
    showToast(`🎵 Alarm tone set to: ${theme.toUpperCase()}`);
}

document.addEventListener('DOMContentLoaded', () => {
    ['click', 'keydown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, initAudio, { once: true });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            document.getElementById('taskTitle')?.focus();
        } else if (e.key === 'Escape') {
            closeEditModal();
        }
    });

    const picker = document.getElementById('soundPicker');
    if (picker) picker.value = currentSoundTheme;

    requestNotificationPermission();
    fetchTasks();
});

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        const bar = document.getElementById('notificationBar');
        if (bar) bar.style.display = 'flex';
    }
}

function enableNotifications() {
    Notification.requestPermission().then(perm => {
        const bar = document.getElementById('notificationBar');
        if (bar) bar.style.display = 'none';
        if (perm === 'granted') showToast('✅ Notifications enabled!');
    });
}

// ── Data Fetching & Progress Stats ─────────────────────────────────────────
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks`);
        allTasks = await res.json();
        updateProgressStats();
        applyFilterAndRender();
        scheduleReminderAlarms();
        startCountdowns();
    } catch (err) {
        console.error('Error fetching tasks:', err);
        document.getElementById('taskList').innerHTML = `<p class="error-msg">⚠️ Could not connect to server.</p>`;
    }
}

function updateProgressStats() {
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    const pending = total - completed;
    const urgent = allTasks.filter(t => !t.completed && (t.priority || '').toLowerCase() === 'urgent').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const fill = document.getElementById('progressBarFill');
    if (fill) fill.style.width = `${percent}%`;

    const numbers = document.getElementById('statsNumbers');
    if (numbers) numbers.textContent = `${completed} / ${total} Completed (${percent}%)`;

    const sPend = document.getElementById('statPending');
    if (sPend) sPend.textContent = `⏳ ${pending} Pending`;

    const sComp = document.getElementById('statCompleted');
    if (sComp) sComp.textContent = `✅ ${completed} Completed`;

    const sUrg = document.getElementById('statUrgent');
    if (sUrg) sUrg.textContent = `🔴 ${urgent} Urgent`;
}

// ── Filtering & Searching ──────────────────────────────────────────────────
function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.filter === filter);
    });
    applyFilterAndRender();
}

function handleFilterChange() {
    applyFilterAndRender();
}

function getFilteredTasks() {
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    return allTasks.filter(task => {
        // Status filter
        if (activeFilter === 'active' && task.completed) return false;
        if (activeFilter === 'completed' && !task.completed) return false;
        // Priority filter
        if (activeFilter === 'urgent' && (task.priority || 'Medium').toLowerCase() !== 'urgent') return false;
        if (activeFilter === 'medium' && (task.priority || 'Medium').toLowerCase() !== 'medium') return false;
        if (activeFilter === 'low' && (task.priority || 'Medium').toLowerCase() !== 'low') return false;
        // Category filter
        if (activeFilter === 'cat-work' && (task.category || 'Personal').toLowerCase() !== 'work') return false;
        if (activeFilter === 'cat-personal' && (task.category || 'Personal').toLowerCase() !== 'personal') return false;
        if (activeFilter === 'cat-study' && (task.category || 'Personal').toLowerCase() !== 'study') return false;

        // Search text matching
        if (searchVal) {
            const titleMatch = (task.title || '').toLowerCase().includes(searchVal);
            const descMatch = (task.description || '').toLowerCase().includes(searchVal);
            if (!titleMatch && !descMatch) return false;
        }

        return true;
    });
}

function applyFilterAndRender() {
    renderTasks(getFilteredTasks());
}

function renderTasks(tasks) {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    if (tasks.length === 0) {
        list.innerHTML = `<p class="empty-msg">No matching tasks found 🎯</p>`;
        return;
    }
    // Sort: pending first, then by priority (Urgent > Medium > Low)
    const priorityWeight = { 'urgent': 3, 'medium': 2, 'low': 1 };
    const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pA = priorityWeight[(a.priority || 'medium').toLowerCase()] || 2;
        const pB = priorityWeight[(b.priority || 'medium').toLowerCase()] || 2;
        return pB - pA;
    });
    sorted.forEach(task => list.appendChild(createTaskCard(task)));
}

// ── Date/Time Picker HTML ──────────────────────────────────────────────────
function buildPickerHTML(taskId, existingIso) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    let selMonth = now.getMonth() + 1, selDay = now.getDate();
    let selYear  = now.getFullYear();
    let selHour  = 12, selMin = '00', selAmpm = 'AM';

    if (existingIso) {
        try {
            const d = new Date(existingIso);
            selMonth = d.getMonth() + 1;
            selDay   = d.getDate();
            selYear  = d.getFullYear();
            let h    = d.getHours();
            selAmpm  = h >= 12 ? 'PM' : 'AM';
            h        = h % 12 || 12;
            selHour  = h;
            selMin   = String(d.getMinutes()).padStart(2, '0');
        } catch {}
    }

    const monthOpts = months.map((m, i) =>
        `<option value="${i+1}" ${selMonth === i+1 ? 'selected' : ''}>${m}</option>`).join('');

    const currentYear = now.getFullYear();
    const yearOpts = Array.from({length: 6}, (_, i) => currentYear + i).map(y =>
        `<option value="${y}" ${selYear === y ? 'selected' : ''}>${y}</option>`).join('');

    const hourOpts = Array.from({length: 12}, (_, i) => i + 1).map(h =>
        `<option value="${h}" ${selHour === h ? 'selected' : ''}>${String(h).padStart(2,'0')}</option>`).join('');

    return `
        <div class="picker-row date-row">
            <select class="glass-select" id="rem-month-${taskId}" title="Month">${monthOpts}</select>
            <input  type="number" class="glass-number" id="rem-day-${taskId}"
                    min="1" max="31" value="${selDay}" title="Day" placeholder="DD">
            <select class="glass-select year-select" id="rem-year-${taskId}" title="Year">${yearOpts}</select>
        </div>
        <div class="picker-row time-row">
            <select class="glass-select hour-select" id="rem-hour-${taskId}" title="Hour">${hourOpts}</select>
            <span class="time-colon">:</span>
            <input  type="number" class="glass-number" id="rem-min-${taskId}"
                    min="0" max="59" value="${parseInt(selMin)}" title="Minute" placeholder="MM">
            <select class="glass-select ampm-select" id="rem-ampm-${taskId}" title="AM/PM">
                <option value="AM" ${selAmpm === 'AM' ? 'selected' : ''}>AM</option>
                <option value="PM" ${selAmpm === 'PM' ? 'selected' : ''}>PM</option>
            </select>
        </div>`;
}

// ── Task Card Component with Subtasks & Edit ───────────────────────────────
function createTaskCard(task) {
    const card = document.createElement('div');
    const priority = task.priority || 'Medium';
    const priorityLower = priority.toLowerCase();
    const category = task.category || 'Personal';
    const recurrence = task.recurrence || 'none';

    card.className = `task-card priority-${priorityLower} ${task.completed ? 'completed' : ''}`;
    card.id = `task-${task.id}`;

    const reminderDisplay = task.reminder_time
        ? `<div class="reminder-set">⏰ ${formatDateTime(task.reminder_time)}</div>`
        : `<div class="reminder-set muted">No reminder set</div>`;

    const countdownHTML = (!task.completed && task.reminder_time)
        ? `<span class="countdown" id="countdown-${task.id}"></span>`
        : '';

    const priorityBadgeHTML = `<span class="priority-badge ${priorityLower}">● ${escapeHtml(priority)}</span>`;
    const categoryBadgeHTML = `<span class="category-badge">🏷️ ${escapeHtml(category)}</span>`;
    const recurrenceBadgeHTML = recurrence !== 'none'
        ? `<span class="recurrence-badge">🔁 ${escapeHtml(recurrence)}</span>`
        : '';

    // Parse subtasks
    let subtasksArray = [];
    try {
        subtasksArray = JSON.parse(task.subtasks || '[]');
    } catch { subtasksArray = []; }

    let subtasksHTML = '';
    if (subtasksArray.length > 0) {
        const items = subtasksArray.map((st, idx) => `
            <div class="subtask-item ${st.done ? 'done' : ''}">
                <input type="checkbox" id="st-${task.id}-${idx}" ${st.done ? 'checked' : ''} onchange="toggleSubtask(${task.id}, ${idx})">
                <label for="st-${task.id}-${idx}">${escapeHtml(st.text)}</label>
            </div>
        `).join('');
        subtasksHTML = `<div class="subtasks-container">${items}</div>`;
    }

    card.innerHTML = `
        <div class="task-left">
            <div class="task-header">
                <span class="status-badge ${task.completed ? 'done' : 'pending'}">${task.completed ? '✓ Done' : '● Pending'}</span>
                ${priorityBadgeHTML}
                ${categoryBadgeHTML}
                ${recurrenceBadgeHTML}
                ${countdownHTML}
            </div>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
            ${subtasksHTML}
            <div class="task-actions">
                <input type="checkbox" class="checkbox-custom" title="Toggle Completion"
                    ${task.completed ? "checked" : ""} 
                    onchange="toggleComplete(${task.id}, ${task.completed})">
                <button class="btn-edit" onclick="openEditModal(${task.id})">✏️ Edit</button>
                <button class="btn-delete" onclick="deleteTask(${task.id})">🗑 Delete</button>
            </div>
        </div>
        <div class="task-right ${task.reminder_time ? 'reminder-active' : ''}">
            <div class="reminder-label">⏰ Reminder</div>
            ${reminderDisplay}
            ${buildPickerHTML(task.id, task.reminder_time)}
            <div class="reminder-buttons">
                <button class="btn-set-reminder" onclick="setReminder(${task.id})">Set</button>
                <button class="btn-clear-reminder" onclick="clearReminder(${task.id})">Clear</button>
            </div>
        </div>
    `;
    return card;
}

// ── Subtask Checklist Handling ─────────────────────────────────────────────
function handleSubtaskInputKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addSubtaskDraft();
    }
}

function addSubtaskDraft() {
    const input = document.getElementById('subtaskDraftInput');
    const text = input.value.trim();
    if (!text) return;
    subtaskDrafts.push(text);
    input.value = '';
    renderSubtaskDrafts();
}

function removeSubtaskDraft(index) {
    subtaskDrafts.splice(index, 1);
    renderSubtaskDrafts();
}

function renderSubtaskDrafts() {
    const list = document.getElementById('subtaskDraftList');
    if (!list) return;
    list.innerHTML = subtaskDrafts.map((text, idx) => `
        <span class="subtask-draft-pill">
            ${escapeHtml(text)}
            <button type="button" onclick="removeSubtaskDraft(${idx})">✕</button>
        </span>
    `).join('');
}

async function toggleSubtask(taskId, subtaskIndex) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
        let subs = JSON.parse(task.subtasks || '[]');
        if (subs[subtaskIndex]) {
            subs[subtaskIndex].done = !subs[subtaskIndex].done;
            const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtasks: JSON.stringify(subs) })
            });
            if (res.ok) fetchTasks();
        }
    } catch (e) { console.error('Error toggling subtask:', e); }
}

// ── CRUD Operations ────────────────────────────────────────────────────────
async function addTask() {
    const titleInput    = document.getElementById('taskTitle');
    const descInput     = document.getElementById('taskDesc');
    const priorityInput = document.querySelector('input[name="taskPriority"]:checked');
    const categoryInput = document.getElementById('taskCategory');
    const recurrenceInput = document.getElementById('taskRecurrence');

    const title       = titleInput.value.trim();
    const description = descInput.value.trim();
    const priority    = priorityInput ? priorityInput.value : 'Medium';
    const category    = categoryInput ? categoryInput.value : 'Personal';
    const recurrence  = recurrenceInput ? recurrenceInput.value : 'none';

    if (!title) { showInputError('Please enter a task title!'); return; }

    const formattedSubtasks = JSON.stringify(subtaskDrafts.map(text => ({ text, done: false })));

    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, category, recurrence, subtasks: formattedSubtasks })
        });
        if (res.ok) {
            titleInput.value = '';
            descInput.value = '';
            subtaskDrafts = [];
            renderSubtaskDrafts();
            fetchTasks();
            showToast('✨ Task added successfully!');
        }
    } catch (err) { console.error('Error adding task:', err); }
}

async function deleteTask(id) {
    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
        if (res.ok) fetchTasks();
    } catch (err) { console.error('Error deleting task:', err); }
}

async function clearCompletedTasks() {
    if (!confirm('Are you sure you want to delete all completed tasks?')) return;
    try {
        const res = await fetch(`${API_URL}/tasks/completed`, { method: 'DELETE' });
        if (res.ok) {
            fetchTasks();
            showToast('🧹 Cleared all completed tasks!');
        }
    } catch (err) { console.error('Error clearing completed tasks:', err); }
}

async function toggleComplete(id, current) {
    const task = allTasks.find(t => t.id === id);
    const newCompleted = !current;

    // Recurring task handling: if marking done and has recurrence, schedule next instance
    if (newCompleted && task && task.recurrence && task.recurrence !== 'none') {
        const nextDate = getNextRecurrenceDate(task.recurrence, task.reminder_time);
        try {
            await fetch(`${API_URL}/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    completed: false, // Keep active for the next recurrence
                    reminder_time: nextDate ? nextDate.toISOString() : null
                })
            });
            const notified = getNotifiedSet();
            notified.delete(String(id));
            saveNotifiedSet(notified);
            fetchTasks();
            showToast(`🔁 Recurring task scheduled for next occurrence!`);
            return;
        } catch (e) { console.error('Recurrence update error:', e); }
    }

    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: newCompleted })
        });
        if (res.ok) fetchTasks();
    } catch (err) { console.error('Error updating task:', err); }
}

function getNextRecurrenceDate(recurrence, currentIso) {
    let base = currentIso ? new Date(currentIso) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    if (recurrence === 'daily') {
        base.setDate(base.getDate() + 1);
    } else if (recurrence === 'weekly') {
        base.setDate(base.getDate() + 7);
    } else if (recurrence === 'weekdays') {
        do { base.setDate(base.getDate() + 1); } while (base.getDay() === 0 || base.getDay() === 6);
    }
    return base;
}

// ── In-Place Edit Modal ────────────────────────────────────────────────────
function openEditModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDesc').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority || 'Medium';
    document.getElementById('editTaskCategory').value = task.category || 'Personal';
    document.getElementById('editTaskRecurrence').value = task.recurrence || 'none';
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
}

async function saveTaskEdit() {
    const id = parseInt(document.getElementById('editTaskId').value);
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDesc').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const category = document.getElementById('editTaskCategory').value;
    const recurrence = document.getElementById('editTaskRecurrence').value;

    if (!title) { alert('Task title cannot be empty.'); return; }

    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, category, recurrence })
        });
        if (res.ok) {
            closeEditModal();
            fetchTasks();
            showToast('💾 Task updated successfully!');
        }
    } catch (err) { console.error('Error updating task edit:', err); }
}

// ── Reminders & Alarms ─────────────────────────────────────────────────────
async function setReminder(id) {
    initAudio();
    const month = parseInt(document.getElementById(`rem-month-${id}`).value);
    const day   = parseInt(document.getElementById(`rem-day-${id}`).value);
    const year  = parseInt(document.getElementById(`rem-year-${id}`).value);
    const ampm  = document.getElementById(`rem-ampm-${id}`).value;
    let hour    = parseInt(document.getElementById(`rem-hour-${id}`).value);
    const min   = parseInt(document.getElementById(`rem-min-${id}`).value);

    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const date = new Date(year, month - 1, day, hour, min, 0);
    if (isNaN(date.getTime())) { showToast('⚠️ Invalid date/time selected.'); return; }

    const isoTime = date.toISOString();
    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminder_time: isoTime })
        });
        if (res.ok) {
            const notified = getNotifiedSet();
            notified.delete(String(id));
            saveNotifiedSet(notified);
            fetchTasks();
            showToast('⏰ Reminder set!');
        }
    } catch (err) { console.error('Error setting reminder:', err); }
}

async function clearReminder(id) {
    try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reminder_time: null })
        });
        if (res.ok) {
            const notified = getNotifiedSet();
            notified.delete(String(id));
            saveNotifiedSet(notified);
            fetchTasks();
        }
    } catch (err) { console.error('Error clearing reminder:', err); }
}

function startCountdowns() {
    if (countdownInterval) clearInterval(countdownInterval);
    updateAllCountdowns();
    countdownInterval = setInterval(updateAllCountdowns, 1000);
}

function updateAllCountdowns() {
    const now = Date.now();
    allTasks.forEach(task => {
        const el = document.getElementById(`countdown-${task.id}`);
        if (!el) return;
        if (!task.reminder_time || task.completed) { el.textContent = ''; return; }

        const target = new Date(task.reminder_time).getTime();
        const diff   = target - now;

        if (diff <= 0) {
            el.textContent = "⌛ Time's up!";
            el.className = 'countdown expired';
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        parts.push(`${h}h`, `${m}m`, `${s}s`);
        el.textContent = '⏱ ' + parts.join(' ');
        el.className = 'countdown';
    });
}

function scheduleReminderAlarms() {
    reminderTimeouts.forEach(t => clearTimeout(t));
    reminderTimeouts = [];

    const now = Date.now();
    const notified = getNotifiedSet();

    allTasks.forEach(task => {
        if (!task.reminder_time || task.completed || notified.has(String(task.id))) return;

        const target = new Date(task.reminder_time).getTime();
        const delay  = target - now;

        if (delay > 0) {
            const t = setTimeout(() => {
                fireReminder(task);
                const n = getNotifiedSet();
                n.add(String(task.id));
                saveNotifiedSet(n);
            }, delay);
            reminderTimeouts.push(t);
        } else if (delay >= -5 * 60 * 1000) {
            fireReminder(task);
            notified.add(String(task.id));
        }
    });

    saveNotifiedSet(notified);
}

let activeAlarm = null;

function startContinuousAlarm(task) {
    stopAlarm();
    playBeep();

    const soundInterval = setInterval(() => {
        playBeep();
    }, 3500);

    const stopTimeout = setTimeout(() => {
        stopAlarm();
    }, 60000);

    activeAlarm = {
        taskId: task ? task.id : null,
        soundInterval,
        stopTimeout,
        taskTitle: task ? task.title : 'Reminder'
    };

    if (task) showReminderBanner(task);
}

function stopAlarm() {
    if (activeAlarm) {
        if (activeAlarm.soundInterval) clearInterval(activeAlarm.soundInterval);
        if (activeAlarm.stopTimeout) clearTimeout(activeAlarm.stopTimeout);
        activeAlarm = null;
    }
    const banner = document.getElementById('reminderBanner');
    if (banner) banner.style.display = 'none';
}

function markAlarmTaskDone(taskId) {
    stopAlarm();
    if (taskId) {
        toggleComplete(taskId, false);
        showToast('🎉 Task marked as complete!');
    }
}

function snoozeTask(taskId) {
    stopAlarm();
    if (!taskId) {
        showToast('💤 Demo alarm snoozed for 5 minutes!');
        return;
    }
    const snoozeDate = new Date(Date.now() + 5 * 60 * 1000);
    const isoTime = snoozeDate.toISOString();

    fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_time: isoTime })
    }).then(res => {
        if (res.ok) {
            const notified = getNotifiedSet();
            notified.delete(String(taskId));
            saveNotifiedSet(notified);
            fetchTasks();
            showToast('💤 Snoozed for 5 minutes!');
        }
    }).catch(err => console.error('Error snoozing task:', err));
}

function fireReminder(task) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(`⏰ Reminder: ${task.title}`, {
                body: task.description || 'Time to complete this task!',
                requireInteraction: true
            });
        } catch (e) { console.warn('Notification failed:', e); }
    }
    startContinuousAlarm(task);
}

function showReminderBanner(task) {
    let banner = document.getElementById('reminderBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'reminderBanner';
        banner.className = 'reminder-banner';
        document.body.prepend(banner);
    }
    const taskIdVal = task ? task.id : null;
    banner.innerHTML = `
        <div class="reminder-banner-content">
            <span class="reminder-banner-text">⏰ <strong>Alarm Ringing:</strong> ${escapeHtml(task ? task.title : 'Reminder')}</span>
            <div class="reminder-banner-actions">
                <button class="btn-alarm-done" onclick="markAlarmTaskDone(${taskIdVal})">✓ Mark as Done</button>
                <button class="btn-alarm-snooze" onclick="snoozeTask(${taskIdVal})">💤 Snooze 5m</button>
                <button class="btn-alarm-stop" onclick="stopAlarm()">⏹ Stop</button>
            </div>
        </div>
    `;
    banner.style.display = 'flex';
}

// ── Multi-Theme Audio Synthesizer ──────────────────────────────────────────
function playBeep() {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    try {
        const theme = currentSoundTheme;
        const now = audioCtx.currentTime;

        if (theme === 'beep') {
            // Classic digital watch beep
            [1200, 1200, 1200].forEach((freq, idx) => {
                const start = now + (idx * 0.12);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.2, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(start);
                osc.stop(start + 0.08);
            });
        } else if (theme === 'marimba') {
            // Warm wooden marimba tones
            [440, 554.37, 659.25, 880].forEach((freq, idx) => {
                const start = now + (idx * 0.1);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.4, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(start);
                osc.stop(start + 0.3);
            });
        } else if (theme === 'siren') {
            // Urgent 2-tone siren
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(700, now);
            osc.frequency.linearRampToValueAtTime(950, now + 0.25);
            osc.frequency.linearRampToValueAtTime(700, now + 0.5);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } else {
            // Default bell chime
            [659.25, 880, 1174.66, 1318.51].forEach((freq, idx) => {
                const start = now + (idx * 0.08);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0.001, start);
                gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(start);
                osc.stop(start + 0.25);
            });
        }
    } catch (e) { console.warn('Audio synthesis failed:', e); }
}

function testAlarmSound() {
    initAudio();
    startContinuousAlarm({ id: null, title: 'Demo Alarm (1 Min Ringing)' });
    showToast(`🔔 Playing ${currentSoundTheme.toUpperCase()} alarm sound!`);
}

// ── Export & Import Tasks (JSON Portability) ───────────────────────────────
function exportTasks() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allTasks, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `tasks_backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchor.click();
    showToast('💾 Tasks exported to JSON!');
}

function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error('Format must be an array of tasks.');
            for (const item of imported) {
                if (item.title) {
                    await fetch(`${API_URL}/tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: item.title,
                            description: item.description || '',
                            priority: item.priority || 'Medium',
                            category: item.category || 'Personal',
                            recurrence: item.recurrence || 'none',
                            subtasks: item.subtasks || '[]'
                        })
                    });
                }
            }
            fetchTasks();
            showToast(`📥 Successfully imported ${imported.length} tasks!`);
        } catch (err) {
            alert('Error parsing JSON backup file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showInputError(msg) {
    let err = document.getElementById('inputError');
    if (!err) {
        err = document.createElement('div');
        err.id = 'inputError';
        err.className = 'input-error';
        document.getElementById('addBtn').before(err);
    }
    err.textContent = msg;
    setTimeout(() => { err.textContent = ''; }, 3000);
}

function getNotifiedSet() {
    try { return new Set(JSON.parse(localStorage.getItem('notified_tasks') || '[]')); }
    catch { return new Set(); }
}

function saveNotifiedSet(set) {
    localStorage.setItem('notified_tasks', JSON.stringify([...set]));
}

function formatDateTime(isoStr) {
    try {
        return new Date(isoStr).toLocaleString(undefined, {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch { return isoStr; }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}