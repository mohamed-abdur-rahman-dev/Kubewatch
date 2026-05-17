# Kubernetes Observability MVP Backend

This is a FastAPI backend that connects to a Kubernetes cluster using the official Python client.

## Requirements
* Python 3.9+
* Access to a Kubernetes cluster (e.g., Minikube, kind, Docker Desktop, or a remote cluster) with your `~/.kube/config` properly set up.

## Running Locally

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the FastAPI server:**
   ```bash
   uvicorn app.main:app --reload
   ```

5. **Access the API:**
   * **Swagger UI (Interactive API Docs):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   * **Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
   * **List Pods (Default Namespace):** [http://127.0.0.1:8000/api/pods](http://127.0.0.1:8000/api/pods)

## Architecture Overview
The backend follows a clean architecture pattern to keep concerns separated:
* `app/main.py`: Application entry point.
* `app/api/`: REST API routing layer.
* `app/services/`: Core business logic and external integrations (like the Kubernetes client).
* `app/models/`: Pydantic data schemas.
* `app/core/`: Centralized configuration.
