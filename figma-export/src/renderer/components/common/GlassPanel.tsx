import React from 'react';

interface Props {
    children: React.ReactNode;
    variant?: 'default' | 'strong';
    className?: string;
    style?: React.CSSProperties;
}

export function GlassPanel({ children, variant = 'default', className, style }: Props) {
    const isStrong = variant === 'strong';
    return (
        <div className={className} style={{
            background: isStrong ? 'var(--glass-bg)' : 'var(--panel-bg)',
            backdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            WebkitBackdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            border: isStrong ? 'var(--glass-border)' : 'var(--panel-border)',
            boxShadow: isStrong ? 'var(--glass-shadow)' : 'var(--panel-shadow)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            ...style,
        }}>
            {children}
        </div>
    );
}
