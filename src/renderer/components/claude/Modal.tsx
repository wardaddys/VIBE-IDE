import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Full-window modal overlay, portaled to <body> so no ancestor (transform,
    overflow, pointer-events) can trap it. Backdrop click + Esc close it;
    clicks inside the dialog do not. */
export function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    return createPortal(
        <div className="cl-modal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            {children}
        </div>,
        document.body,
    );
}
