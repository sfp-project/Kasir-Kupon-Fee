import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan tidak terduga pada aplikasi Kasir.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen neu-canvas flex items-center justify-center p-6">
          <div className="neu-raised max-w-lg w-full rounded-2xl p-6 space-y-4">
            <h1 className="text-lg font-extrabold text-slate-900">
              Terjadi Gangguan Koneksi Data
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aplikasi mengalami kendala saat memproses data Firebase Firestore. Silakan muat ulang halaman atau periksa izin akses akun Anda.
            </p>
            <pre className="neu-inset rounded-xl p-3 text-xs font-mono text-red-800 overflow-x-auto whitespace-pre-wrap break-all">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="neu-btn-emerald px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
