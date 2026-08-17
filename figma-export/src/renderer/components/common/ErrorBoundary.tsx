import React from 'react';

interface Props { children: React.ReactNode; label?: string }
interface State { error: Error | null }

/**
 * Catches render/runtime errors in a subtree and shows them INSTEAD of letting
 * the exception unmount the whole React root (which is why a single bad render
 * — e.g. mapping over an undefined array — used to blank the entire window).
 * In the happy path it renders children directly, so it adds no DOM node and
 * doesn't disturb flex/grid layouts.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State { return { error }; }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Route to the console (mirrored into the VIBE debug-log window) rather
        // than silently white-screening.
        console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error?.message, info?.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <div style={{ padding: 20, overflow: 'auto', fontFamily: 'var(--cl-mono, ui-monospace, monospace)', color: 'var(--cl-text, #ddd)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--cl-accent, #c96442)' }}>
                    {this.props.label ? `${this.props.label} hit an error` : 'This view hit an error'}
                </div>
                <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 12, opacity: 0.85 }}>
                    {String(error?.stack || error?.message || error)}
                </div>
                <button className="cl-winbtn" style={{ width: 'auto', padding: '4px 12px' }} onClick={this.reset}>
                    Reload this view
                </button>
            </div>
        );
    }
}
