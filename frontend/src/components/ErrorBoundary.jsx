import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Enterprise Dashboard Fault Captured:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-surface border border-danger/30 rounded-xl shadow-2xl flex flex-col items-center justify-center min-h-[300px] text-center">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Component Isolation Boundary Triggered</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            {this.state.error?.message || "An unhandled UI rendering exception occurred. The platform state core prevented full application cascade."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-5 px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reset Context View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
