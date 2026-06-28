import {
    Component,
    type ComponentType,
    type ErrorInfo,
    type ReactNode,
} from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppErrorBoundaryProps = {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
};

type AppErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
    errorId: string | null;
};

const createErrorId = (error: Error) => {
    const source = `${error.name}:${error.message}:${Date.now()}`;
    let hash = 0;

    for (let i = 0; i < source.length; i += 1) {
        hash = (hash << 5) - hash + source.charCodeAt(i);
        hash |= 0;
    }

    return `KLN-${Math.abs(hash).toString(16).toUpperCase().slice(0, 8)}`;
};

export class AppErrorBoundary extends Component<
    AppErrorBoundaryProps,
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = {
        hasError: false,
        error: null,
        errorId: null,
    };

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return {
            hasError: true,
            error,
            errorId: createErrorId(error),
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const errorId = this.state.errorId ?? createErrorId(error);

        this.props.onError?.(error, errorInfo, errorId);

        if (import.meta.env.DEV) {
            console.groupCollapsed(`[Arcadia ErrorBoundary] ${errorId}`);
            console.error(error);
            console.error(errorInfo.componentStack);
            console.groupEnd();
        }
    }

    private reset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorId: null,
        });
    };

    private reload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        return (
            <main className="min-h-screen bg-background text-foreground">
                <div className="container flex min-h-screen items-center justify-center py-16">
                    <section
                        role="alert"
                        aria-live="assertive"
                        className="surface-elevated relative w-full max-w-xl overflow-hidden rounded-lg p-8 text-center shadow-card"
                    >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-signal" />
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10">
                            <AlertTriangle
                                className="h-8 w-8 text-destructive"
                                aria-hidden="true"
                            />
                        </div>

                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                            Arcadia safety stop
                        </p>
                        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                            Something unexpected happened
                        </h1>
                        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                            The interface hit a protected error state before
                            your session could continue. Your wallet and funds
                            are not affected.
                        </p>

                        <div className="mt-6 rounded-lg border border-border bg-background-secondary/60 p-4 text-left">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Error reference
                                </span>
                                <span className="font-mono text-xs text-foreground">
                                    {this.state.errorId ?? "KLN-UNKNOWN"}
                                </span>
                            </div>
                            {import.meta.env.DEV &&
                                this.state.error?.message && (
                                    <p className="mt-3 break-words border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                                        {this.state.error.message}
                                    </p>
                                )}
                        </div>

                        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button
                                onClick={this.reset}
                                className="bg-gradient-signal text-primary-foreground border-0"
                            >
                                <RefreshCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Try again
                            </Button>
                            <Button onClick={this.reload} variant="outline">
                                Reload app
                            </Button>
                            <Button asChild variant="ghost">
                                <a href="/">
                                    <Home
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Home
                                </a>
                            </Button>
                        </div>
                    </section>
                </div>
            </main>
        );
    }
}

export const withAppErrorBoundary = <P extends object>(
    WrappedComponent: ComponentType<P>,
    boundaryProps?: Omit<AppErrorBoundaryProps, "children">,
) => {
    const ComponentWithErrorBoundary = (props: P) => (
        <AppErrorBoundary {...boundaryProps}>
            <WrappedComponent {...props} />
        </AppErrorBoundary>
    );

    ComponentWithErrorBoundary.displayName = `withAppErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"})`;

    return ComponentWithErrorBoundary;
};

export default AppErrorBoundary;
