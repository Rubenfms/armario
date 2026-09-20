import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Red de seguridad: un error de render en cualquier pantalla muestra esto en
 * vez de una pantalla en blanco. Los datos no se tocan; recargar suele bastar.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de render', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen title="Algo ha fallado" message={this.state.error.message} />;
  }
}

export function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
      <p className="text-sm text-muted">Tus prendas y outfits siguen guardados en el dispositivo.</p>
      <button type="button" className="btn-primary mt-2" onClick={() => window.location.reload()}>
        Recargar
      </button>
    </div>
  );
}
