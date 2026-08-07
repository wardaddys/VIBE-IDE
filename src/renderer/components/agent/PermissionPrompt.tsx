import React from 'react';
import type { PermissionRequest } from '../../../shared/agent';
import { approvePermission } from '../../services/agentClient';

const TIER_LABEL: Record<string, string> = { safe: 'read', mutating: 'write', exec: 'run command', network: 'network' };

export function PermissionPrompt({ req, resolved }: { req: PermissionRequest; resolved?: 'allow' | 'deny' }) {
    if (resolved) {
        return (
            <div className="cl-status" style={{ color: resolved === 'allow' ? '#2f7d47' : '#b5473b', fontStyle: 'normal' }}>
                {resolved === 'allow' ? 'Approved' : 'Denied'}: {req.render}
            </div>
        );
    }
    return (
        <div className="cl-perm">
            <div className="cl-perm__t">Permission needed — {TIER_LABEL[req.tier] || req.tier}</div>
            <div className="cl-perm__d">{req.render}</div>
            {req.target && <div className="cl-perm__target">{req.target}</div>}
            <div className="cl-perm__row">
                <button className="cl-btn cl-btn--primary" onClick={() => approvePermission(req.id, 'allow', 'once')}>Allow once</button>
                <button className="cl-btn cl-btn--ghost" onClick={() => approvePermission(req.id, 'allow', 'session')}>Allow for session</button>
                <button className="cl-btn cl-btn--ghost" onClick={() => approvePermission(req.id, 'allow', 'always')}>Always allow</button>
                <button className="cl-btn cl-btn--danger" onClick={() => approvePermission(req.id, 'deny', 'once')}>Deny</button>
            </div>
        </div>
    );
}
