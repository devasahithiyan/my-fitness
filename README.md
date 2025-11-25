# Workout Dashboard

This is a local web dashboard to visualize your Hevy workout data.

## How to use

1.  Open `index.html` in your web browser (Chrome, Edge, Firefox, etc.).
2.  If the data doesn't load automatically:
    - Click the **"Load CSV"** button in the top right corner.
    - Select your `workouts.csv` file from the parent folder.

## Features

- **Overview**: Total workouts, volume, sets, and unique exercises.
- **Charts**:
  - Workouts per Month
  - Top 5 Exercises
  - Weekly Volume Progression
- **History**: List of your recent workouts with details.

## Note on Automatic Loading

For security reasons, browsers often block web pages from reading files on your computer automatically (CORS policy). That is why you might need to manually select the file using the "Load CSV" button.

If you want automatic loading to work:

1.  Install a simple HTTP server (e.g., `npm install -g http-server` or use Python `python -m http.server`).
2.  Run the server in the `hevy` folder.
3.  Open `http://localhost:8000/dashboard/`.
