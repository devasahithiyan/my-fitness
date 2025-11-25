// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDgwCxhDYwxHof3O9mv4dYB2v_2Fd89nOA",
  authDomain: "my-fitness-f6d29.firebaseapp.com",
  projectId: "my-fitness-f6d29",
  storageBucket: "my-fitness-f6d29.firebasestorage.app",
  messagingSenderId: "400131584480",
  appId: "1:400131584480:web:2cdd5a965ef02da6d97b85"
};

// Initialize Firebase
let db, auth, storage;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    storage = firebase.storage();
    console.log("Firebase initialized");
} catch (e) {
    console.error("Firebase initialization failed", e);
}

// --- CONFIGURATION & MAPPINGS ---

const MUSCLE_MAP = {
    // Chest
    'Bench Press': 'Chest', 'Chest Press': 'Chest', 'Fly': 'Chest', 'Push Up': 'Chest', 'Dip': 'Chest', 'Pec Deck': 'Chest',
    // Back
    'Lat Pulldown': 'Back', 'Row': 'Back', 'Pull Up': 'Back', 'Chin Up': 'Back', 'Deadlift': 'Back', 'Face Pull': 'Back', 'Shrug': 'Back',
    // Legs
    'Squat': 'Legs', 'Leg Press': 'Legs', 'Lunge': 'Legs', 'Extension': 'Legs', 'Curl': 'Legs', 'Calf': 'Legs', 'Abduction': 'Legs', 'Adduction': 'Legs',
    // Shoulders
    'Overhead Press': 'Shoulders', 'Shoulder Press': 'Shoulders', 'Lateral Raise': 'Shoulders', 'Front Raise': 'Shoulders', 'Arnold Press': 'Shoulders', 'Reverse Fly': 'Shoulders',
    // Arms
    'Bicep Curl': 'Arms', 'Hammer Curl': 'Arms', 'Preacher Curl': 'Arms', 'Triceps': 'Arms', 'Skullcrusher': 'Arms', 'Pushdown': 'Arms', 'Extension': 'Arms',
    // Core
    'Crunch': 'Core', 'Plank': 'Core', 'Leg Raise': 'Core', 'Ab Wheel': 'Core', 'Sit Up': 'Core',
    // Cardio
    'Running': 'Cardio', 'Cycling': 'Cardio', 'Treadmill': 'Cardio'
};

function getMuscleGroup(exerciseName) {
    if (!exerciseName) return 'Other';
    const name = exerciseName.toLowerCase();
    
    if (name.includes('chest') || name.includes('bench') || name.includes('fly') || name.includes('push up') || name.includes('pec')) return 'Chest';
    if (name.includes('lat') || name.includes('row') || name.includes('pull up') || name.includes('chin up') || name.includes('deadlift') || name.includes('shrug') || name.includes('face pull')) return 'Back';
    if (name.includes('squat') || name.includes('leg') || name.includes('calf') || name.includes('lunge') || name.includes('abduction') || name.includes('adduction')) return 'Legs';
    if (name.includes('shoulder') || name.includes('overhead') || name.includes('lateral') || name.includes('front raise') || name.includes('arnold') || name.includes('rear delt')) return 'Shoulders';
    if (name.includes('bicep') || name.includes('tricep') || name.includes('curl') || name.includes('skullcrusher') || name.includes('pushdown') || name.includes('extension')) return 'Arms';
    if (name.includes('crunch') || name.includes('plank') || name.includes('sit up') || name.includes('ab wheel')) return 'Core';
    if (name.includes('run') || name.includes('cycle') || name.includes('treadmill')) return 'Cardio';
    
    return 'Other';
}

// --- STATE MANAGEMENT ---

let appState = {
    rawData: [],
    workouts: [],
    muscleStats: {},
    exerciseStats: {},
    charts: {},
    dietData: {}, // { 'YYYY-MM-DD': ['breakfast', 'lunch_3'] }
    currentDietDate: new Date(),
    user: null
};

// --- DIET CONFIGURATION ---

const DIET_CONFIG = [
    { id: 'breakfast', name: 'Breakfast (Oats + Whey)', protein: 30, score: 2.0 },
    { 
        id: 'lunch', 
        name: 'Lunch', 
        isVariable: true,
        defaultOption: 'lunch_3',
        options: [
            { id: 'lunch_1', name: 'Lunch (1 Egg)', label: '1 Egg', protein: 6, score: 0.4 },
            { id: 'lunch_2', name: 'Lunch (2 Eggs)', label: '2 Eggs', protein: 12, score: 0.8 },
            { id: 'lunch_3', name: 'Lunch (3 Eggs)', label: '3 Eggs', protein: 18, score: 1.2 }
        ]
    },
    { 
        id: 'evening', 
        name: 'Evening Snack', 
        isGroup: true,
        items: [
            { id: 'evening_lassi', name: 'Amul Protein Lassi', protein: 15, score: 1.0 },
            { id: 'evening_omelette', name: 'Bread Omelette (2 Eggs)', protein: 14, score: 1.0 }
        ]
    },
    { id: 'dinner', name: 'Dinner (Chapathi + 200g Chicken)', protein: 55, score: 3.6 },
    { id: 'creatine', name: 'Creatine (5g)', protein: 0, score: 1.2 }
];

function getDietItem(id) {
    for (const item of DIET_CONFIG) {
        if (item.id === id) return item;
        if (item.options) {
            const opt = item.options.find(o => o.id === id);
            if (opt) return opt;
        }
        if (item.items) {
            const sub = item.items.find(i => i.id === id);
            if (sub) return sub;
        }
    }
    return null;
}

// --- DOM ELEMENTS ---

const els = {
    fileInput: document.getElementById('csvInput'),
    loading: document.getElementById('loadingState'),
    empty: document.getElementById('emptyState'),
    content: document.getElementById('contentArea'),
    mainContainer: document.getElementById('mainContainer'),
    modal: document.getElementById('modalOverlay'),
    modalContent: document.getElementById('modalContent'),
    modalTitle: document.getElementById('modalTitle'),
    pageTitle: document.getElementById('pageTitle'),
    lastUpdate: document.getElementById('lastUpdate')
};

// --- NAVIGATION ---

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

function switchTab(tabId) {
    // Close sidebar on mobile if open
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
        toggleSidebar();
    }

    // Update Sidebar
    document.querySelectorAll('nav a').forEach(el => {
        el.classList.remove('bg-zinc-900', 'text-white', 'border-l-2', 'border-lime-400');
        el.classList.add('text-zinc-500', 'hover:text-white', 'hover:bg-zinc-900');
    });
    
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.remove('text-zinc-500', 'hover:text-white', 'hover:bg-zinc-900');
        activeNav.classList.add('bg-zinc-900', 'text-white', 'border-l-2', 'border-lime-400');
    }
    
    // Update Content
    const views = ['overview', 'analytics', 'muscles', 'exercises', 'records', 'history', 'diet'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            if (v === tabId) {
                el.classList.remove('hidden');
                el.classList.add('animate-fade-in');
            } else {
                el.classList.add('hidden');
                el.classList.remove('animate-fade-in');
            }
        }
    });
    
    // Update Title
    const titles = {
        'overview': 'Dashboard Overview',
        'analytics': 'Deep Analytics',
        'muscles': 'Muscle Group Analysis',
        'exercises': 'Exercise Database',
        'records': 'Personal Records',
        'history': 'Workout History',
        'diet': 'Diet & Nutrition Tracker'
    };
    if (els.pageTitle) els.pageTitle.textContent = titles[tabId] || 'Dashboard';
    
    if (tabId === 'diet') renderDietView();
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Check dependencies
    if (typeof Chart === 'undefined' || typeof Papa === 'undefined') {
        console.error("Libraries not loaded");
        // Fallback: try to show empty state if hidden
        if (els.empty) els.empty.classList.remove('hidden');
        if (els.loading) els.loading.classList.add('hidden');
    } else {
        // Set Chart.js Defaults for Dark Mode
        Chart.defaults.color = '#a1a1aa'; // zinc-400
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
        Chart.defaults.plugins.tooltip.backgroundColor = '#09090b'; // zinc-950
        Chart.defaults.plugins.tooltip.titleColor = '#f4f4f5'; // zinc-100
        Chart.defaults.plugins.tooltip.bodyColor = '#a1a1aa'; // zinc-400
        Chart.defaults.plugins.tooltip.borderColor = '#27272a'; // zinc-800
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.displayColors = true;
    }

    if (els.fileInput) {
        els.fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Initialize Auth
    if (auth) {
        auth.signInAnonymously().catch((error) => {
            console.error("Auth Error", error);
        });

        auth.onAuthStateChanged((user) => {
            if (user) {
                appState.user = user;
                console.log("User signed in: ", user.uid);
                loadFromFirebase();
            }
        });
    } else {
        loadDietData(); // Fallback to local storage
    }
    
    attemptAutoLoad();
});

function attemptAutoLoad() {
    fetch('../workouts.csv')
        .then(res => {
            if (!res.ok) throw new Error("No auto-load file");
            return res.text();
        })
        .then(processCSV)
        .catch(() => {
            console.log("Waiting for user upload");
            // Ensure empty state is visible
            if (els.loading) els.loading.classList.add('hidden');
            if (els.empty) els.empty.classList.remove('hidden');
        });
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    els.loading.classList.remove('hidden');
    els.empty.classList.add('hidden');
    
    // Upload raw CSV to Firebase Storage
    uploadCSVToFirebase(file);

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            processData(results.data);
            // We don't need to save workouts to Firestore anymore, 
            // as we uploaded the CSV directly.
            // But we still might want to save diet data if it changed?
            // Actually saveToFirebase handles diet data too.
            saveToFirebase(); 
        },
        error: (err) => {
            alert("Error parsing CSV");
            console.error(err);
            els.loading.classList.add('hidden');
        }
    });
}

function processCSV(csvText) {
    els.loading.classList.remove('hidden');
    els.empty.classList.add('hidden');
    Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data)
    });
}

// --- DATA PROCESSING ---

function processData(data) {
    if (!data || data.length === 0) {
        console.warn("Empty data received");
        els.loading.classList.add('hidden');
        els.empty.classList.remove('hidden');
        return;
    }

    appState.rawData = data;
    
    // Sort data chronologically first for PR detection
    data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const workoutsMap = new Map();
    const muscleStats = {};
    const exerciseStats = {};
    
    // Track current maxes for PR detection
    const currentMaxes = {}; // { exerciseName: maxWeight }

    data.forEach(row => {
        if (!row.start_time || !row.exercise_title) return;
        
        // Workout Grouping
        const wId = row.start_time;
        if (!workoutsMap.has(wId)) {
            workoutsMap.set(wId, {
                id: wId,
                date: new Date(row.start_time),
                title: row.title,
                startTime: new Date(row.start_time),
                endTime: new Date(row.end_time),
                sets: [],
                volume: 0,
                exercises: new Set(),
                rpeSum: 0,
                rpeCount: 0
            });
        }
        
        const workout = workoutsMap.get(wId);
        const weight = parseFloat(row.weight_kg) || 0;
        const reps = parseFloat(row.reps) || 0;
        const volume = weight * reps;
        const muscle = getMuscleGroup(row.exercise_title);
        const rpe = parseFloat(row.rpe);
        
        // PR Detection
        let isPR = false;
        if (weight > 0) {
            const curMax = currentMaxes[row.exercise_title] || 0;
            if (weight > curMax) {
                isPR = true;
                currentMaxes[row.exercise_title] = weight;
            }
        }

        // Add to workout
        workout.volume += volume;
        workout.exercises.add(row.exercise_title);
        if (!isNaN(rpe)) {
            workout.rpeSum += rpe;
            workout.rpeCount++;
        }
        
        workout.sets.push({
            exercise: row.exercise_title,
            muscle: muscle,
            weight,
            reps,
            type: row.set_type,
            volume,
            rpe: rpe,
            notes: row.exercise_notes,
            isPR: isPR
        });

        // Muscle Stats
        if (!muscleStats[muscle]) muscleStats[muscle] = { sets: 0, volume: 0, workouts: new Set() };
        muscleStats[muscle].sets++;
        muscleStats[muscle].volume += volume;
        muscleStats[muscle].workouts.add(wId);

        // Exercise Stats
        const exName = row.exercise_title;
        if (!exerciseStats[exName]) {
            exerciseStats[exName] = {
                name: exName,
                muscle: muscle,
                sets: 0,
                volume: 0,
                maxWeight: 0,
                est1RM: 0,
                history: []
            };
        }
        
        const est1RM = weight * (1 + reps/30);
        const stats = exerciseStats[exName];
        stats.sets++;
        stats.volume += volume;
        if (weight > stats.maxWeight) stats.maxWeight = weight;
        if (est1RM > stats.est1RM) stats.est1RM = est1RM;
        stats.history.push({ date: workout.date, weight, reps, est1RM });
    });

    appState.workouts = Array.from(workoutsMap.values()).sort((a, b) => b.date - a.date);
    appState.muscleStats = muscleStats;
    appState.exerciseStats = Object.values(exerciseStats);

    // Save to Firebase if user is logged in and this is new data
    // We might want to be careful not to overwrite if we just loaded FROM firebase
    // But for now, let's assume if processData is called, we have fresh data to show/save.
    // However, processData is called by attemptAutoLoad too.
    // Let's add a flag or separate save function.
    
    // Update UI
    els.loading.classList.add('hidden');
    els.content.classList.remove('hidden');
    
    if (appState.workouts.length > 0) {
        els.lastUpdate.textContent = `Last workout: ${appState.workouts[0].date.toLocaleDateString()}`;
    }

    renderOverview();
    renderMuscles();
    renderExercises();
    renderRecords();
    renderHistory();
    renderAnalytics();
}

// --- UTILITIES ---

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// --- RENDERING: OVERVIEW ---

function renderOverview() {
    try {
        // KPIs
        const workoutCount = appState.workouts ? appState.workouts.length : 0;
        const elWorkouts = document.getElementById('kpi-workouts');
        if (elWorkouts) elWorkouts.textContent = workoutCount;
        
        const totalVol = appState.workouts.reduce((acc, w) => acc + (w.volume || 0), 0);
        const elVolume = document.getElementById('kpi-volume');
        if (elVolume) elVolume.textContent = formatNumber(totalVol) + " kg";
        
        const setCount = appState.rawData ? appState.rawData.length : 0;
        const elSets = document.getElementById('kpi-sets');
        if (elSets) elSets.textContent = formatNumber(setCount);
        
        const uniqueDays = new Set(appState.workouts.map(w => w.date ? w.date.toDateString() : ''));
        const elDays = document.getElementById('kpi-days');
        if (elDays) elDays.textContent = uniqueDays.size;

        // Charts - Wrapped in timeouts to prevent blocking and isolate errors
        setTimeout(() => {
            try { renderVolumeChart(); } catch(e) { console.error("Error rendering Volume Chart:", e); }
        }, 0);
        setTimeout(() => {
            try { renderConsistencyChart(); } catch(e) { console.error("Error rendering Consistency Chart:", e); }
        }, 0);
        setTimeout(() => {
            try { renderMuscleSplitChart(); } catch(e) { console.error("Error rendering Muscle Split Chart:", e); }
        }, 0);
        setTimeout(() => {
            try { renderIntensityChart(); } catch(e) { console.error("Error rendering Intensity Chart:", e); }
        }, 0);
        setTimeout(() => {
            try { renderHeatmap(); } catch(e) { console.error("Error rendering Heatmap:", e); }
        }, 0);

    } catch (error) {
        console.error("Critical error in renderOverview:", error);
        alert("An error occurred while rendering the dashboard. Please check the console for details.");
    }
}

function renderVolumeChart() {
    const canvas = document.getElementById('volumeChart');
    const ctx = canvas.getContext('2d');
    if (appState.charts.volume) appState.charts.volume.destroy();

    const weeklyVol = {};
    appState.workouts.forEach(w => {
        const d = new Date(w.date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        const key = d.toISOString().split('T')[0];
        weeklyVol[key] = (weeklyVol[key] || 0) + w.volume;
    });

    const sortedKeys = Object.keys(weeklyVol).sort();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.2)'); // Lime 400
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.volume = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys.map(k => new Date(k).toLocaleDateString(undefined, {month:'short', day:'numeric'})),
            datasets: [{
                label: 'Volume (kg)',
                data: sortedKeys.map(k => weeklyVol[k]),
                borderColor: '#a3e635', // Lime 400
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderConsistencyChart() {
    const ctx = document.getElementById('consistencyChart').getContext('2d');
    if (appState.charts.consistency) appState.charts.consistency.destroy();

    const monthly = {};
    appState.workouts.forEach(w => {
        const key = w.date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthly[key] = (monthly[key] || 0) + 1;
    });
    
    const sortedKeys = Object.keys(monthly).sort((a,b) => {
        const [ma, ya] = a.split(' ');
        const [mb, yb] = b.split(' ');
        return new Date(`${ma} 1, 20${ya}`) - new Date(`${mb} 1, 20${yb}`);
    });

    appState.charts.consistency = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: 'Workouts',
                data: sortedKeys.map(k => monthly[k]),
                backgroundColor: '#ffffff',
                borderRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderMuscleSplitChart() {
    const ctx = document.getElementById('muscleSplitChart').getContext('2d');
    if (appState.charts.split) appState.charts.split.destroy();

    // Group sets by Month -> Muscle
    const data = {}; // { 'Jan 23': { Chest: 10, Back: 5 } }
    const muscles = new Set();

    appState.workouts.forEach(w => {
        const key = w.date.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!data[key]) data[key] = {};
        
        w.sets.forEach(s => {
            if (!data[key][s.muscle]) data[key][s.muscle] = 0;
            data[key][s.muscle]++;
            muscles.add(s.muscle);
        });
    });

    const sortedMonths = Object.keys(data).sort((a,b) => {
        const [ma, ya] = a.split(' ');
        const [mb, yb] = b.split(' ');
        return new Date(`${ma} 1, 20${ya}`) - new Date(`${mb} 1, 20${yb}`);
    });

    const muscleList = Array.from(muscles);
    // High contrast palette
    const colors = ['#a3e635', '#ffffff', '#a1a1aa', '#52525b', '#3f3f46', '#27272a', '#71717a', '#d4d4d8'];

    const datasets = muscleList.map((m, i) => ({
        label: m,
        data: sortedMonths.map(month => data[month][m] || 0),
        backgroundColor: colors[i % colors.length]
    }));

    appState.charts.split = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function renderIntensityChart() {
    const canvas = document.getElementById('intensityChart');
    const ctx = canvas.getContext('2d');
    if (appState.charts.intensity) appState.charts.intensity.destroy();

    // Filter workouts with RPE data
    const workoutsWithRPE = appState.workouts
        .filter(w => w.rpeCount > 0)
        .sort((a, b) => a.date - b.date); // Chronological

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.5)'); // Lime 400
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.intensity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: workoutsWithRPE.map(w => w.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})),
            datasets: [{
                label: 'Avg RPE',
                data: workoutsWithRPE.map(w => (w.rpeSum / w.rpeCount).toFixed(1)),
                borderColor: '#a3e635', // Lime
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    min: 5, 
                    max: 10,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '';
    
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(today.getDate() - 365);
    
    const workoutDates = new Set(appState.workouts.map(w => w.date.toDateString()));
    
    const grid = document.createElement('div');
    grid.className = 'flex flex-col flex-wrap h-32 gap-1 content-start'; 
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toDateString();
        const hasWorkout = workoutDates.has(dateStr);
        
        const cell = document.createElement('div');
        cell.className = `w-3 h-3 rounded-sm transition-all hover:scale-125 ${hasWorkout ? 'bg-lime-400 shadow-lg shadow-lime-400/20' : 'bg-zinc-800'}`;
        cell.title = dateStr;
        grid.appendChild(cell);
    }
    
    container.appendChild(grid);
}

// --- RENDERING: MUSCLES ---

function renderMuscles() {
    const muscles = Object.keys(appState.muscleStats);
    const volumes = muscles.map(m => appState.muscleStats[m].volume);
    const sets = muscles.map(m => appState.muscleStats[m].sets);

    // Radar Chart
    const ctxRadar = document.getElementById('muscleRadarChart').getContext('2d');
    if (appState.charts.radar) appState.charts.radar.destroy();
    
    appState.charts.radar = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: muscles,
            datasets: [{
                label: 'Volume Distribution',
                data: volumes,
                backgroundColor: 'rgba(163, 230, 53, 0.2)', // Lime 400
                borderColor: '#a3e635',
                pointBackgroundColor: '#a3e635'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                r: { 
                    beginAtZero: true, 
                    ticks: { display: false },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    angleLines: { color: 'rgba(255, 255, 255, 0.05)' }
                } 
            }
        }
    });

    // Pie Chart
    const ctxPie = document.getElementById('musclePieChart').getContext('2d');
    if (appState.charts.pie) appState.charts.pie.destroy();
    
    appState.charts.pie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: muscles,
            datasets: [{
                data: sets,
                backgroundColor: [
                    '#a3e635', '#ffffff', '#a1a1aa', '#52525b', '#3f3f46', '#27272a', '#71717a', '#d4d4d8'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#a1a1aa' } } }
        }
    });

    // Table
    const tbody = document.getElementById('muscleTableBody');
    tbody.innerHTML = '';
    
    const totalSets = sets.reduce((a,b) => a+b, 0);
    
    muscles.sort((a,b) => appState.muscleStats[b].sets - appState.muscleStats[a].sets).forEach(m => {
        const stat = appState.muscleStats[m];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-900 transition-colors';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-zinc-200">${m}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${formatNumber(stat.sets)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${formatNumber(stat.volume)} kg</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${stat.workouts.size}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${((stat.sets / totalSets) * 100).toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- RENDERING: EXERCISES ---

let currentSort = { field: 'sets', dir: 'desc' };

function renderExercises() {
    const tbody = document.getElementById('exerciseTableBody');
    tbody.innerHTML = '';
    
    const search = document.getElementById('exerciseSearch').value.toLowerCase();
    
    let filtered = appState.exerciseStats.filter(ex => 
        ex.name.toLowerCase().includes(search)
    );
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[currentSort.field];
        let valB = b[currentSort.field];
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
    
    filtered.forEach(ex => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-900 transition-colors border-b border-zinc-800 last:border-0';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-zinc-200">${ex.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400"><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded bg-zinc-900 text-zinc-300 border border-zinc-800">${ex.muscle}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400 text-right">${formatNumber(ex.sets)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400 text-right">${ex.maxWeight} kg</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400 text-right">${ex.est1RM.toFixed(1)} kg</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="showExerciseDetails('${ex.name.replace(/'/g, "\\'")}')" class="text-lime-400 hover:text-lime-300 transition-colors font-bold uppercase text-xs tracking-wider">Analyze</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function sortExercises(field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.dir = 'desc';
    }
    renderExercises();
}

document.getElementById('exerciseSearch').addEventListener('input', renderExercises);

// --- RENDERING: RECORDS ---

function renderRecords() {
    const container = document.getElementById('recordsContainer');
    container.innerHTML = '';

    // Sort exercises by max weight to find "Big Lifts"
    // Or just pick popular ones if they exist
    const priority = ['Squat', 'Deadlift', 'Bench Press', 'Overhead Press', 'Pull Up'];
    
    // Filter for priority exercises first, then fill with top others
    let records = appState.exerciseStats.filter(e => priority.some(p => e.name.includes(p)));
    
    // If not enough, add top by weight
    if (records.length < 6) {
        const others = appState.exerciseStats
            .filter(e => !records.includes(e))
            .sort((a,b) => b.maxWeight - a.maxWeight)
            .slice(0, 6 - records.length);
        records = [...records, ...others];
    }

    records.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-xl border border-zinc-800 p-6 hover:border-lime-400 transition-all duration-300 group';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-bold text-lg text-white group-hover:text-lime-400 transition-colors">${rec.name}</h3>
                    <span class="text-xs font-bold px-2 py-1 bg-black rounded text-zinc-500 border border-zinc-800 mt-1 inline-block uppercase tracking-wider">${rec.muscle}</span>
                </div>
                <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    <i class="fa-solid fa-trophy text-white text-lg"></i>
                </div>
            </div>
            <div class="space-y-3">
                <div class="flex justify-between items-center p-2 rounded hover:bg-black transition-colors">
                    <span class="text-sm text-zinc-500 uppercase tracking-wider font-bold">Max Weight</span>
                    <span class="text-lg font-black text-white italic">${rec.maxWeight} kg</span>
                </div>
                <div class="flex justify-between items-center p-2 rounded hover:bg-black transition-colors">
                    <span class="text-sm text-zinc-500 uppercase tracking-wider font-bold">Est. 1RM</span>
                    <span class="text-lg font-black text-lime-400 italic">${rec.est1RM.toFixed(1)} kg</span>
                </div>
                <div class="flex justify-between items-center p-2 rounded hover:bg-black transition-colors">
                    <span class="text-sm text-zinc-500 uppercase tracking-wider font-bold">Total Sets</span>
                    <span class="text-lg font-bold text-zinc-400">${rec.sets}</span>
                </div>
            </div>
            <button onclick="showExerciseDetails('${rec.name.replace(/'/g, "\\'")}')" class="w-full mt-4 py-3 text-sm font-bold text-black bg-lime-400 rounded-lg hover:bg-lime-300 transition-all uppercase tracking-wide">
                View Progress
            </button>
        `;
        container.appendChild(card);
    });
}

// --- RENDERING: HISTORY ---

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';
    
    appState.workouts.forEach(w => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-900 cursor-pointer transition-colors border-b border-zinc-800 last:border-0';
        tr.onclick = () => openWorkoutModal(w);
        
        const duration = Math.round((w.endTime - w.startTime) / 60000);
        const durationStr = isNaN(duration) ? '-' : `${duration} min`;
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400 font-mono">${w.date.toLocaleDateString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">${w.title}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${durationStr}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${formatNumber(w.volume)} kg</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">${w.sets.length}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 truncate max-w-xs">${Array.from(w.exercises).slice(0,3).join(', ')}${w.exercises.size > 3 ? '...' : ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODALS & DETAILS ---

function openWorkoutModal(workout) {
    els.modalTitle.textContent = `${workout.title} - ${workout.date.toLocaleDateString()}`;
    
    // Group sets by exercise
    const grouped = {};
    workout.sets.forEach(s => {
        if (!grouped[s.exercise]) grouped[s.exercise] = [];
        grouped[s.exercise].push(s);
    });
    
    let html = '<div class="space-y-6">';
    for (const [name, sets] of Object.entries(grouped)) {
        html += `
            <div class="border border-zinc-800 rounded-xl p-4 bg-zinc-900">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-lg text-white">${name}</h4>
                    <span class="text-xs font-bold px-2 py-1 bg-black rounded border border-zinc-800 text-zinc-400 uppercase tracking-wider">${sets[0].muscle}</span>
                </div>
                <div class="grid grid-cols-6 gap-4 text-xs font-bold text-zinc-500 mb-2 border-b border-zinc-800 pb-2 uppercase tracking-wider">
                    <div>SET</div>
                    <div>KG</div>
                    <div>REPS</div>
                    <div>RPE</div>
                    <div>1RM</div>
                    <div>NOTES</div>
                </div>
                <div class="space-y-2">
        `;
        
        sets.forEach((s, i) => {
            const e1rm = s.weight * (1 + s.reps/30);
            const prBadge = s.isPR ? '<span class="ml-2 text-[10px] bg-lime-400/20 text-lime-400 px-1.5 py-0.5 rounded border border-lime-400/30 font-bold">PR</span>' : '';
            const rpeVal = s.rpe ? s.rpe : '-';
            const notes = s.notes ? `<span class="text-xs text-zinc-500 italic">${s.notes}</span>` : '-';
            
            html += `
                <div class="grid grid-cols-6 gap-4 text-sm text-zinc-300 items-center hover:bg-black p-1 rounded transition-colors">
                    <div class="font-medium text-zinc-500">${i + 1}</div>
                    <div class="font-bold flex items-center text-white">${s.weight} ${prBadge}</div>
                    <div class="font-medium">${s.reps}</div>
                    <div class="text-zinc-400">${rpeVal}</div>
                    <div class="text-zinc-500">${e1rm.toFixed(1)}</div>
                    <div class="truncate text-xs">${notes}</div>
                </div>
            `;
        });
        html += '</div></div>';
    }
    html += '</div>';
    
    els.modalContent.innerHTML = html;
    els.modal.classList.remove('hidden');
}

function showExerciseDetails(exerciseName) {
    // Reuse modal for exercise details chart
    const stats = appState.exerciseStats.find(e => e.name === exerciseName);
    if (!stats) return;
    
    els.modalTitle.textContent = `Analysis: ${exerciseName}`;
    
    const history = stats.history.sort((a,b) => a.date - b.date);
    
    els.modalContent.innerHTML = `
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Max Weight</div>
                <div class="text-2xl font-black text-white italic">${stats.maxWeight} kg</div>
            </div>
            <div class="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Best Est. 1RM</div>
                <div class="text-2xl font-black text-lime-400 italic">${stats.est1RM.toFixed(1)} kg</div>
            </div>
            <div class="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                <div class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Sets</div>
                <div class="text-2xl font-black text-zinc-400 italic">${stats.sets}</div>
            </div>
        </div>
        <div class="h-80 w-full">
            <canvas id="modalChart"></canvas>
        </div>
    `;
    
    els.modal.classList.remove('hidden');
    
    // Render chart in modal
    const ctx = document.getElementById('modalChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => h.date.toLocaleDateString()),
            datasets: [
                {
                    label: 'Est. 1RM',
                    data: history.map(h => h.est1RM),
                    borderColor: '#a3e635', // Lime
                    tension: 0.4,
                    pointBackgroundColor: '#a3e635',
                    pointBorderColor: '#000'
                },
                {
                    label: 'Weight Used',
                    data: history.map(h => h.weight),
                    borderColor: '#ffffff', // White
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#000'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function closeModal() {
    els.modal.classList.add('hidden');
}

els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closeModal();
});

// --- RENDERING: ANALYTICS ---

function renderAnalytics() {
    renderMonthlyComparison();
    renderWeeklyComparison();
    renderSessionTrends();
    renderDayOfWeekAnalysis();
    renderDayOfWeekVolume();
    renderAvgMuscleVolume();
    renderAvgMonthlyVolume();
    renderWeeklyVolumeProgress();
    renderStrengthProgression();
    renderTrainingSignature();
    renderRepRangeChart();
    renderSetTypeChart();
    renderDensityChart();
}

function renderWeeklyVolumeProgress() {
    const canvas = document.getElementById('weeklyVolumeProgressChart');
    const ctx = canvas.getContext('2d');
    if (appState.charts.weeklyProgress) appState.charts.weeklyProgress.destroy();

    const now = new Date();
    // Start of last month
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate.setHours(0,0,0,0);

    const weeklyData = {};

    appState.workouts.forEach(w => {
        if (w.date < startDate) return;
        
        const d = new Date(w.date);
        // Get Monday of the week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        
        const key = monday.toISOString().split('T')[0];
        if (!weeklyData[key]) weeklyData[key] = { vol: 0, count: 0 };
        weeklyData[key].vol += w.volume;
        weeklyData[key].count += 1;
    });

    const sortedKeys = Object.keys(weeklyData).sort();
    const averages = sortedKeys.map(k => Math.round(weeklyData[k].vol / weeklyData[k].count));
    
    // Calculate Average Session Volume over the whole period for the single number
    let totalVol = 0;
    let totalCount = 0;
    sortedKeys.forEach(k => {
        totalVol += weeklyData[k].vol;
        totalCount += weeklyData[k].count;
    });
    
    if (totalCount > 0) {
        const avg = totalVol / totalCount;
        const el = document.getElementById('avgWeeklyVolumeDisplay');
        if (el) el.textContent = formatNumber(avg) + ' kg';
    } else {
        const el = document.getElementById('avgWeeklyVolumeDisplay');
        if (el) el.textContent = '-';
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.5)'); // Lime 400
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.weeklyProgress = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys.map(k => {
                const d = new Date(k);
                const month = d.toLocaleString('default', { month: 'short' });
                const weekNum = Math.ceil(d.getDate() / 7);
                return `${month} Week ${weekNum}`;
            }),
            datasets: [{
                label: 'Avg Session Volume',
                data: averages,
                borderColor: '#a3e635', // Lime
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (ctx) => ctx[0].label,
                        label: (ctx) => `Avg Volume: ${formatNumber(ctx.raw)} kg`
                    }
                }
            }
        }
    });
}

function renderStrengthProgression() {
    const ctx = document.getElementById('strengthProgressionChart').getContext('2d');
    if (appState.charts.strengthProg) appState.charts.strengthProg.destroy();

    // Filter for Big 3
    const big3 = ['Squat', 'Bench Press', 'Deadlift'];
    const datasets = [];
    const colors = { 'Squat': '#a3e635', 'Bench Press': '#ffffff', 'Deadlift': '#a1a1aa' }; // Lime, White, Zinc

    big3.forEach(exercise => {
        // Find all sets for this exercise
        const history = [];
        appState.workouts.forEach(w => {
            w.sets.forEach(s => {
                if (s.exercise.includes(exercise)) {
                    const e1rm = s.weight * (1 + s.reps/30);
                    history.push({ date: w.date, e1rm });
                }
            });
        });

        // Sort by date
        history.sort((a, b) => a.date - b.date);

        // Get max per day to reduce noise
        const dailyMax = {};
        history.forEach(h => {
            const key = h.date.toISOString().split('T')[0];
            if (!dailyMax[key] || h.e1rm > dailyMax[key]) dailyMax[key] = h.e1rm;
        });

        const dataPoints = Object.keys(dailyMax).map(k => ({ x: k, y: dailyMax[k] }));
        
        if (dataPoints.length > 0) {
            datasets.push({
                label: exercise,
                data: dataPoints,
                borderColor: colors[exercise],
                backgroundColor: colors[exercise],
                tension: 0.3,
                pointRadius: 3
            });
        }
    });

    appState.charts.strengthProg = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month' },
                    title: { display: false },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    title: { display: true, text: 'Est. 1RM (kg)', color: '#71717a' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (ctx) => new Date(ctx[0].raw.x).toLocaleDateString(),
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y.toFixed(1)} kg`
                    }
                }
            }
        }
    });
}

function renderTrainingSignature() {
    const ctx = document.getElementById('trainingSignatureChart').getContext('2d');
    if (appState.charts.signature) appState.charts.signature.destroy();

    // 1. Calculate Metrics for Current vs Last Month
    const now = new Date();
    const currentMonthKey = now.toLocaleString('default', { month: 'short', year: '2-digit' });
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(now.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toLocaleString('default', { month: 'short', year: '2-digit' });

    const getMetrics = (monthKey) => {
        let volume = 0, sets = 0, workouts = 0, rpeSum = 0, rpeCount = 0, durationSum = 0;
        
        appState.workouts.forEach(w => {
            const key = w.date.toLocaleString('default', { month: 'short', year: '2-digit' });
            if (key === monthKey) {
                volume += w.volume;
                sets += w.sets.length;
                workouts++;
                if (w.rpeCount > 0) {
                    rpeSum += w.rpeSum;
                    rpeCount += w.rpeCount;
                }
                durationSum += (w.endTime - w.startTime) / 60000;
            }
        });

        return {
            volume: workouts ? volume : 0,
            intensity: rpeCount ? (rpeSum / rpeCount) : 0,
            frequency: workouts,
            density: durationSum ? (volume / durationSum) : 0,
            duration: workouts ? (durationSum / workouts) : 0
        };
    };

    const current = getMetrics(currentMonthKey);
    const last = getMetrics(lastMonthKey);

    // 2. Normalize Data (0-100 scale relative to max of both)
    const normalize = (val1, val2) => {
        const max = Math.max(val1, val2) || 1; // Avoid div by zero
        return [ (val1 / max) * 100, (val2 / max) * 100 ];
    };

    const [vol1, vol2] = normalize(current.volume, last.volume);
    const [int1, int2] = normalize(current.intensity, last.intensity);
    const [freq1, freq2] = normalize(current.frequency, last.frequency);
    const [den1, den2] = normalize(current.density, last.density);
    const [dur1, dur2] = normalize(current.duration, last.duration);

    appState.charts.signature = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Volume', 'Intensity', 'Frequency', 'Density', 'Duration'],
            datasets: [
                {
                    label: 'This Month',
                    data: [vol1, int1, freq1, den1, dur1],
                    backgroundColor: 'rgba(163, 230, 53, 0.2)', // Lime
                    borderColor: '#a3e635',
                    pointBackgroundColor: '#a3e635'
                },
                {
                    label: 'Last Month',
                    data: [vol2, int2, freq2, den2, dur2],
                    backgroundColor: 'rgba(255, 255, 255, 0.1)', // White
                    borderColor: '#ffffff',
                    pointBackgroundColor: '#ffffff'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#a1a1aa' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false } // Hide the 0-100 numbers
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            // Show actual values instead of normalized ones
                            const idx = ctx.dataIndex;
                            const isCurrent = ctx.datasetIndex === 0;
                            const rawObj = isCurrent ? current : last;
                            const keys = ['volume', 'intensity', 'frequency', 'density', 'duration'];
                            const key = keys[idx];
                            let val = rawObj[key];
                            
                            if (key === 'volume') val = (val/1000).toFixed(1) + 'k kg';
                            else if (key === 'intensity') val = val.toFixed(1) + ' RPE';
                            else if (key === 'frequency') val = val + ' workouts';
                            else if (key === 'density') val = val.toFixed(1) + ' kg/min';
                            else if (key === 'duration') val = val.toFixed(0) + ' min';
                            
                            return `${ctx.dataset.label}: ${val}`;
                        }
                    }
                }
            }
        }
    });
}

function renderMonthlyComparison() {
    // Get current date info
    const now = new Date();
    const currentMonthKey = now.toLocaleString('default', { month: 'short', year: '2-digit' });
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(now.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toLocaleString('default', { month: 'short', year: '2-digit' });

    document.getElementById('analytics-month-label').textContent = `${currentMonthKey} vs ${lastMonthKey}`;

    // Aggregate data
    const stats = {
        current: { workouts: 0, volume: 0, sets: 0 },
        last: { workouts: 0, volume: 0, sets: 0 }
    };

    appState.workouts.forEach(w => {
        const key = w.date.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (key === currentMonthKey) {
            stats.current.workouts++;
            stats.current.volume += w.volume;
            stats.current.sets += w.sets.length;
        } else if (key === lastMonthKey) {
            stats.last.workouts++;
            stats.last.volume += w.volume;
            stats.last.sets += w.sets.length;
        }
    });

    // Update DOM
    updateComparisonCard('month', stats.current, stats.last);
}

function renderWeeklyComparison() {
    // Get current week info (ISO week would be better, but simple approximation for now)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0,0,0,0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setDate(startOfWeek.getDate() - 1); // Sunday

    document.getElementById('analytics-week-label').textContent = `This Week vs Last Week`;

    // Aggregate data
    const stats = {
        current: { workouts: 0, volume: 0, sets: 0 },
        last: { workouts: 0, volume: 0, sets: 0 }
    };

    appState.workouts.forEach(w => {
        const d = new Date(w.date);
        d.setHours(0,0,0,0);
        
        if (d >= startOfWeek) {
            stats.current.workouts++;
            stats.current.volume += w.volume;
            stats.current.sets += w.sets.length;
        } else if (d >= startOfLastWeek && d <= endOfLastWeek) {
            stats.last.workouts++;
            stats.last.volume += w.volume;
            stats.last.sets += w.sets.length;
        }
    });

    // Update DOM
    updateComparisonCard('week', stats.current, stats.last);
}

function updateComparisonCard(period, current, last) {
    const metrics = ['workouts', 'volume', 'sets'];
    
    metrics.forEach(m => {
        const elVal = document.getElementById(`comp-${period}-${m}`);
        const elDiff = document.getElementById(`diff-${period}-${m}`);
        
        // Value
        let valStr = current[m];
        if (m === 'volume') valStr = formatNumber(valStr) + ' kg';
        elVal.textContent = valStr;
        
        // Diff
        let diff = 0;
        if (last[m] > 0) {
            diff = ((current[m] - last[m]) / last[m]) * 100;
        } else if (current[m] > 0) {
            diff = 100; // 0 to something is 100% increase effectively
        }
        
        const sign = diff > 0 ? '+' : '';
        const color = diff >= 0 ? 'text-lime-400' : 'text-red-500';
        const icon = diff >= 0 ? '↑' : '↓';
        
        elDiff.innerHTML = `<span class="${color} font-medium">${icon} ${sign}${diff.toFixed(1)}%</span>`;
    });
}

function renderSessionTrends() {
    // Session Volume Chart
    const canvasVol = document.getElementById('sessionVolumeChart');
    const ctxVol = canvasVol.getContext('2d');
    if (appState.charts.sessionVol) appState.charts.sessionVol.destroy();

    // Moving Average of Volume per Session (last 20 workouts)
    const recentWorkouts = [...appState.workouts].reverse().slice(-30); // Last 30 workouts, chronological
    
    const gradientVol = ctxVol.createLinearGradient(0, 0, 0, 400);
    gradientVol.addColorStop(0, 'rgba(163, 230, 53, 0.5)'); // Lime 400
    gradientVol.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.sessionVol = new Chart(ctxVol, {
        type: 'line',
        data: {
            labels: recentWorkouts.map(w => w.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})),
            datasets: [{
                label: 'Volume per Session',
                data: recentWorkouts.map(w => w.volume),
                borderColor: '#a3e635', // Lime
                backgroundColor: gradientVol,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Session Duration Chart
    const ctxDur = document.getElementById('sessionDurationChart').getContext('2d');
    if (appState.charts.sessionDur) appState.charts.sessionDur.destroy();

    appState.charts.sessionDur = new Chart(ctxDur, {
        type: 'bar',
        data: {
            labels: recentWorkouts.map(w => w.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})),
            datasets: [{
                label: 'Duration (min)',
                data: recentWorkouts.map(w => Math.round((w.endTime - w.startTime) / 60000)),
                backgroundColor: '#ffffff', // White
                borderRadius: 4,
                hoverBackgroundColor: '#e4e4e7'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderDayOfWeekAnalysis() {
    const ctx = document.getElementById('dayOfWeekChart').getContext('2d');
    if (appState.charts.dayOfWeek) appState.charts.dayOfWeek.destroy();

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = new Array(7).fill(0);
    
    appState.workouts.forEach(w => {
        counts[w.date.getDay()]++;
    });

    appState.charts.dayOfWeek = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Workouts',
                data: counts,
                backgroundColor: [
                    '#27272a', '#a3e635', '#a3e635', '#a3e635', '#a3e635', '#a3e635', '#27272a'
                ],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, x: { grid: { display: false } } }
        }
    });
}

function renderDayOfWeekVolume() {
    const ctx = document.getElementById('dayOfWeekVolumeChart').getContext('2d');
    if (appState.charts.dayOfWeekVol) appState.charts.dayOfWeekVol.destroy();

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const volumes = new Array(7).fill(0);
    const counts = new Array(7).fill(0);
    
    appState.workouts.forEach(w => {
        const day = w.date.getDay();
        volumes[day] += w.volume;
        counts[day]++;
    });

    const averages = volumes.map((vol, i) => counts[i] > 0 ? vol / counts[i] : 0);

    appState.charts.dayOfWeekVol = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Avg Volume (kg)',
                data: averages,
                backgroundColor: '#a3e635', // Lime
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, x: { grid: { display: false } } }
        }
    });
}

function renderAvgMuscleVolume() {
    const ctx = document.getElementById('avgMuscleVolumeChart').getContext('2d');
    if (appState.charts.avgMuscleVol) appState.charts.avgMuscleVol.destroy();

    const muscles = Object.keys(appState.muscleStats);
    const averages = muscles.map(m => {
        const stat = appState.muscleStats[m];
        return stat.workouts.size > 0 ? stat.volume / stat.workouts.size : 0;
    });

    // Sort by average volume
    const combined = muscles.map((m, i) => ({ name: m, avg: averages[i] }));
    combined.sort((a, b) => b.avg - a.avg);

    appState.charts.avgMuscleVol = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: combined.map(c => c.name),
            datasets: [{
                label: 'Avg Volume/Session (kg)',
                data: combined.map(c => c.avg),
                backgroundColor: '#a3e635', // Lime
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, y: { grid: { display: false } } }
        }
    });
}

function renderAvgMonthlyVolume() {
    const canvas = document.getElementById('avgMonthlyVolumeChart');
    const ctx = canvas.getContext('2d');
    if (appState.charts.avgMonthlyVol) appState.charts.avgMonthlyVol.destroy();

    const monthlyData = {}; // { 'Jan 23': { vol: 0, count: 0 } }

    appState.workouts.forEach(w => {
        const key = w.date.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (!monthlyData[key]) monthlyData[key] = { vol: 0, count: 0 };
        monthlyData[key].vol += w.volume;
        monthlyData[key].count++;
    });

    const sortedKeys = Object.keys(monthlyData).sort((a,b) => {
        const [ma, ya] = a.split(' ');
        const [mb, yb] = b.split(' ');
        return new Date(`${ma} 1, 20${ya}`) - new Date(`${mb} 1, 20${yb}`);
    });

    const averages = sortedKeys.map(k => monthlyData[k].vol / monthlyData[k].count);

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.5)'); // Lime 400
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.avgMonthlyVol = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: 'Avg Workout Volume (kg)',
                data: averages,
                borderColor: '#a3e635', // Lime
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderRepRangeChart() {
    const ctx = document.getElementById('repRangeChart').getContext('2d');
    if (appState.charts.repRange) appState.charts.repRange.destroy();
    
    let ranges = { 'Strength (1-5)': 0, 'Hypertrophy (6-12)': 0, 'Endurance (13+)': 0 };

    appState.workouts.forEach(w => {
        w.sets.forEach(s => {
            if (s.reps > 0) {
                if (s.reps <= 5) ranges['Strength (1-5)']++;
                else if (s.reps <= 12) ranges['Hypertrophy (6-12)']++;
                else ranges['Endurance (13+)']++;
            }
        });
    });

    appState.charts.repRange = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                data: Object.values(ranges),
                backgroundColor: ['#a3e635', '#ffffff', '#52525b'], // Lime, White, Zinc-600
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 2000,
                easing: 'easeOutBounce'
            }
        }
    });
}

function renderSetTypeChart() {
    const ctx = document.getElementById('setTypeChart').getContext('2d');
    if (appState.charts.setType) appState.charts.setType.destroy();
    
    let types = {};
    appState.workouts.forEach(w => {
        w.sets.forEach(s => {
            const type = s.type || 'normal';
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            types[label] = (types[label] || 0) + 1;
        });
    });

    appState.charts.setType = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(types),
            datasets: [{
                data: Object.values(types),
                backgroundColor: ['#a3e635', '#ffffff', '#a1a1aa', '#52525b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa' } } },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1500,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function renderDensityChart() {
    const canvas = document.getElementById('densityChart');
    const ctx = canvas.getContext('2d');
    if (appState.charts.density) appState.charts.density.destroy();
    
    // Sort workouts chronologically
    const sortedWorkouts = [...appState.workouts].sort((a, b) => a.date - b.date);
    const recentWorkouts = sortedWorkouts.slice(-20);

    const labels = recentWorkouts.map(w => w.date.toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    const data = recentWorkouts.map(w => {
        const durationMin = (w.endTime - w.startTime) / 60000;
        const validDuration = durationMin > 0 ? durationMin : 60; // Fallback
        return (w.volume / validDuration).toFixed(1);
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.5)'); // Lime 400
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    appState.charts.density = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Density (kg/min)',
                data: data,
                borderColor: '#a3e635', // Lime
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#a3e635',
                pointBorderColor: '#000000',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Kg per Minute', color: '#71717a' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            animation: {
                y: {
                    duration: 2000,
                    from: 500
                }
            }
        }
    });
}

// --- DEMO DATA ---

function loadDemoData() {
    els.loading.classList.remove('hidden');
    els.empty.classList.add('hidden');
    
    // Simulate network delay for effect
    setTimeout(() => {
        const demoData = generateDemoData();
        processData(demoData);
    }, 800);
}

function generateDemoData() {
    const exercises = [
        { title: 'Squat', base: 60, inc: 0.5 }, 
        { title: 'Bench Press', base: 40, inc: 0.3 }, 
        { title: 'Deadlift', base: 80, inc: 0.6 },
        { title: 'Overhead Press', base: 30, inc: 0.2 }, 
        { title: 'Pull Up', base: 0, inc: 0.1 }, 
        { title: 'Dumbbell Row', base: 20, inc: 0.2 },
        { title: 'Tricep Pushdown', base: 15, inc: 0.1 }, 
        { title: 'Bicep Curl', base: 10, inc: 0.1 }, 
        { title: 'Leg Extension', base: 30, inc: 0.3 }
    ];
    
    const data = [];
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    let totalDays = 0;
    
    // Generate ~150 workouts over the last year
    for (let d = new Date(oneYearAgo); d <= now; d.setDate(d.getDate() + Math.floor(Math.random() * 3) + 1)) {
        totalDays++;
        const dateStr = d.toISOString();
        const duration = 3600 + Math.random() * 1800; // 60-90 mins
        const endTimeStr = new Date(d.getTime() + duration * 1000).toISOString();
        
        // Progress factor (0.0 to 1.0)
        const progress = Math.min(1, totalDays / 365);
        
        // 4-6 exercises per workout
        const numExercises = Math.floor(Math.random() * 3) + 4;
        const workoutExercises = [];
        for(let i=0; i<numExercises; i++) {
            workoutExercises.push(exercises[Math.floor(Math.random() * exercises.length)]);
        }
        
        workoutExercises.forEach(ex => {
            // 3-4 sets per exercise
            const numSets = Math.floor(Math.random() * 2) + 3;
            for(let s=0; s<numSets; s++) {
                // Weight increases with time + random noise
                const weight = Math.floor(ex.base + (ex.base * ex.inc * progress) + (Math.random() * 5));
                
                data.push({
                    start_time: dateStr,
                    end_time: endTimeStr,
                    title: 'Workout',
                    exercise_title: ex.title,
                    weight_kg: weight,
                    reps: Math.floor(Math.random() * 6) + 6, // 6-12 reps
                    set_type: 'normal',
                    rpe: Math.floor(Math.random() * 3) + 7, // 7-9 RPE
                    exercise_notes: '',
                    duration_seconds: duration
                });
            }
        });
    }
    return data;
}

// --- FIREBASE SYNC ---

async function loadFromFirebase() {
    if (!appState.user || !db) return;
    
    try {
        // 1. Load Diet Data from Firestore
        const docRef = db.collection('users').doc(appState.user.uid);
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            if (data.dietData) {
                appState.dietData = data.dietData;
                renderDietView();
            }
        }

        // 2. Load CSV from Storage
        if (storage) {
            const storageRef = storage.ref();
            const workoutsRef = storageRef.child(`users/${appState.user.uid}/workouts.csv`);
            
            try {
                console.log("Checking for cloud backup...");
                const url = await workoutsRef.getDownloadURL();
                const response = await fetch(url);
                const csvText = await response.text();
                console.log("Restoring workouts from cloud CSV...");
                processCSV(csvText);
            } catch (e) {
                console.log("No remote CSV found or error downloading", e);
            }
        }

    } catch (e) {
        console.error("Error loading from Firebase", e);
    }
}

async function uploadCSVToFirebase(file) {
    if (!appState.user || !storage) return;
    
    const storageRef = storage.ref();
    const workoutsRef = storageRef.child(`users/${appState.user.uid}/workouts.csv`);
    
    try {
        // Show some UI feedback if possible, or just log
        console.log("Uploading CSV to cloud...");
        await workoutsRef.put(file);
        console.log("CSV uploaded successfully");
        
        // Visual feedback
        const updateEl = document.getElementById('lastUpdate');
        if (updateEl) {
            const originalText = updateEl.textContent;
            updateEl.textContent = "Uploading CSV...";
            updateEl.classList.add('text-zinc-400');
            
            setTimeout(() => {
                updateEl.textContent = "Cloud Sync Complete ✓";
                updateEl.classList.remove('text-zinc-400');
                updateEl.classList.add('text-lime-400');
                setTimeout(() => {
                    updateEl.textContent = originalText;
                    updateEl.classList.remove('text-lime-400');
                }, 3000);
            }, 1000);
        }

    } catch (e) {
        console.error("Error uploading CSV", e);
        alert("Failed to upload CSV to cloud");
    }
}

async function saveToFirebase() {
    if (!appState.user || !db) return;
    
    try {
        const dataToSave = {
            dietData: appState.dietData,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // We NO LONGER save workouts to Firestore JSON to avoid 1MB limit.
        // The CSV upload handles the workout data persistence.

        await db.collection('users').doc(appState.user.uid).set(dataToSave, { merge: true });
        console.log("Synced Diet/Meta to Firebase");
        
    } catch (e) {
        console.error("Error saving to Firebase", e);
    }
}

// --- RENDERING: DIET ---

function renderDietView() {
    const dateStr = appState.currentDietDate.toISOString().split('T')[0];
    const displayDate = appState.currentDietDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const dateDisplay = document.getElementById('diet-date-display');
    if (dateDisplay) dateDisplay.textContent = displayDate;

    // Get today's data
    const todayItems = appState.dietData[dateStr] || [];
    
    // Calculate Score & Protein
    let score = 0;
    let protein = 0;
    let maxScore = 0;

    const container = document.getElementById('diet-checklist');
    if (container) {
        container.innerHTML = '';
        
        DIET_CONFIG.forEach(item => {
            // Calculate max score
            if (item.isGroup) {
                // For groups, we assume 1 item is the target
                maxScore += item.items[0].score; 
            } else if (item.isVariable) {
                // For variable, assume max option is target? Or maybe middle?
                // Let's assume the default option is the target
                const def = item.options.find(o => o.id === item.defaultOption);
                maxScore += def ? def.score : 0;
            } else {
                maxScore += item.score;
            }

            // Render Item Card
            const card = document.createElement('div');
            
            // Check if completed
            let isCompleted = false;
            let currentSelection = null;

            if (item.isGroup) {
                const found = item.items.find(sub => todayItems.includes(sub.id));
                if (found) {
                    isCompleted = true;
                    currentSelection = found;
                    score += found.score;
                    protein += found.protein;
                }
            } else if (item.isVariable) {
                const found = item.options.find(opt => todayItems.includes(opt.id));
                if (found) {
                    isCompleted = true;
                    currentSelection = found;
                    score += found.score;
                    protein += found.protein;
                }
            } else {
                if (todayItems.includes(item.id)) {
                    isCompleted = true;
                    score += item.score;
                    protein += item.protein;
                }
            }

            card.className = `p-4 rounded-xl border transition-all cursor-pointer ${isCompleted ? 'bg-lime-400 border-lime-500' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`;
            
            let html = '';
            if (item.isGroup) {
                html += `<div class="font-bold ${isCompleted ? 'text-black' : 'text-white'} mb-2">${item.name}</div>`;
                html += `<div class="flex flex-wrap gap-2">`;
                item.items.forEach(sub => {
                    const isSelected = todayItems.includes(sub.id);
                    html += `<button onclick="toggleDietItem('${sub.id}', '${item.id}', true)" class="px-2 py-1 text-xs rounded border ${isSelected ? 'bg-black text-white border-black' : (isCompleted ? 'bg-white/50 text-black border-black/10' : 'bg-black text-zinc-400 border-zinc-700 hover:border-zinc-500')}">${sub.name}</button>`;
                });
                html += `</div>`;
            } else if (item.isVariable) {
                html += `<div class="font-bold ${isCompleted ? 'text-black' : 'text-white'} mb-2">${item.name}</div>`;
                html += `<div class="flex flex-wrap gap-2">`;
                item.options.forEach(opt => {
                    const isSelected = todayItems.includes(opt.id);
                    html += `<button onclick="toggleDietItem('${opt.id}', '${item.id}', true)" class="px-2 py-1 text-xs rounded border ${isSelected ? 'bg-black text-white border-black' : (isCompleted ? 'bg-white/50 text-black border-black/10' : 'bg-black text-zinc-400 border-zinc-700 hover:border-zinc-500')}">${opt.label}</button>`;
                });
                html += `</div>`;
            } else {
                html += `
                    <div class="flex justify-between items-center h-full" onclick="toggleDietItem('${item.id}')">
                        <span class="font-bold ${isCompleted ? 'text-black' : 'text-white'}">${item.name}</span>
                        <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${isCompleted ? 'border-black bg-black text-lime-400' : 'border-zinc-600'}">
                            ${isCompleted ? '<i class="fa-solid fa-check text-xs"></i>' : ''}
                        </div>
                    </div>
                `;
            }
            
            card.innerHTML = html;
            container.appendChild(card);
        });
    }

    // Update Stats
    const elScore = document.getElementById('diet-today-score');
    if (elScore) elScore.textContent = `${score.toFixed(1)}/${maxScore.toFixed(1)}`;
    
    const elProtein = document.getElementById('diet-today-protein');
    if (elProtein) elProtein.textContent = protein;
    
    const elPercent = document.getElementById('diet-today-percent');
    if (elPercent) elPercent.textContent = Math.round((score / maxScore) * 100);

    renderDietCharts();
}

function toggleDietItem(itemId, groupId, isExclusive) {
    const dateStr = appState.currentDietDate.toISOString().split('T')[0];
    let items = appState.dietData[dateStr] || [];
    
    if (isExclusive) {
        // Remove other items from the same group
        const group = DIET_CONFIG.find(i => i.id === groupId);
        if (group) {
            const allIds = group.items ? group.items.map(i => i.id) : group.options.map(o => o.id);
            // If clicking the already selected one, toggle it off
            if (items.includes(itemId)) {
                items = items.filter(i => i !== itemId);
            } else {
                // Remove others, add this one
                items = items.filter(i => !allIds.includes(i));
                items.push(itemId);
            }
        }
    } else {
        // Simple toggle
        if (items.includes(itemId)) {
            items = items.filter(i => i !== itemId);
        } else {
            items.push(itemId);
        }
    }
    
    appState.dietData[dateStr] = items;
    saveToFirebase();
    renderDietView();
}

function renderDietCharts() {
    // Prepare data for last 30 days
    const dates = [];
    const scores = [];
    const proteins = [];
    
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dates.push(d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'}));
        
        const items = appState.dietData[key] || [];
        let s = 0;
        let p = 0;
        
        items.forEach(id => {
            const item = getDietItem(id);
            if (item) {
                s += item.score;
                p += item.protein;
            }
        });
        
        scores.push(s);
        proteins.push(p);
    }

    // Score Chart
    const ctxScore = document.getElementById('dietScoreChart').getContext('2d');
    if (appState.charts.dietScore) appState.charts.dietScore.destroy();
    
    appState.charts.dietScore = new Chart(ctxScore, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Diet Score',
                data: scores,
                borderColor: '#a3e635', // Lime
                backgroundColor: 'rgba(163, 230, 53, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Protein Chart
    const ctxProtein = document.getElementById('dietProteinChart').getContext('2d');
    if (appState.charts.dietProtein) appState.charts.dietProtein.destroy();
    
    appState.charts.dietProtein = new Chart(ctxProtein, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Protein (g)',
                data: proteins,
                backgroundColor: '#ffffff', // White
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Calculate Averages
    const calcAvg = (arr) => (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1);
    
    const weekScores = scores.slice(-7);
    const weekProteins = proteins.slice(-7);
    
    document.getElementById('diet-avg-week').textContent = calcAvg(weekScores);
    document.getElementById('diet-avg-month').textContent = calcAvg(scores);
    document.getElementById('diet-avg-protein-week').textContent = Math.round(calcAvg(weekProteins)) + 'g';
    document.getElementById('diet-avg-protein-month').textContent = Math.round(calcAvg(proteins)) + 'g';
    
    // All time (simple approx using available data)
    document.getElementById('diet-avg-all').textContent = calcAvg(scores);
    document.getElementById('diet-avg-protein-all').textContent = Math.round(calcAvg(proteins)) + 'g';
}

function loadDietData() {
    const stored = localStorage.getItem('hevy_diet_data');
    if (stored) {
        appState.dietData = JSON.parse(stored);
        renderDietView();
    }
}
