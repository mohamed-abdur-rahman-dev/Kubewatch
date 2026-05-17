# Kubernetes Observability Dashboard

A modern React frontend for the K8s AI Observability MVP.

## Tech Stack
* React 18 + Vite
* TailwindCSS 3
* Axios (API requests)
* Recharts (Metrics visualization)
* React Flow (Dependency/Topology mapping)
* Lucide React (Icons)

## Setup Instructions

1. Ensure you have Node.js installed (v16+ recommended).
2. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:3000`

**Note:** Make sure the FastAPI backend is running on `http://127.0.0.1:8000` to fetch live data.
