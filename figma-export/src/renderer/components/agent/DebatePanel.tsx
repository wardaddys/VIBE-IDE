/* =======================================================================
   DebatePanel.tsx — UI for the dual-model debate feature.

   Shows:
   - Model A / Model B pickers
   - Round count selector
   - Optional judge model for synthesis
   - Start/Cancel buttons
   - Live streaming debate transcript (side-by-side per round)
   - Interjection input
   - Synthesis result
   ======================================================================= */
import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Button, Select, MenuItem, FormControl, InputLabel,
    ToggleButton, ToggleButtonGroup, TextField, IconButton, Divider, Chip,
    CircularProgress, Tooltip, Collapse,
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ForumIcon from '@mui/icons-material/Forum';
import SendIcon from '@mui/icons-material/Send';
import { useDebateStore, type DebateRound } from '../../store/debate';
import { useSettingsStore } from '../../store/settings';
import { extractThink } from '../claude/Markdown';

const colorA = '#4fc3f7';   // blue
const colorB = '#ffb74d';   // amber

/** Hide inline <think> reasoning (and stray tags) from a reasoning model. */
const clean = (t: string): string => extractThink(t || '').visible.replace(/<\/?think>/gi, '').trim();

function RoundView({ round }: { round: DebateRound }) {
    return (
        <Paper elevation={0} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Chip
                    size="small"
                    label={`Round ${round.round}`}
                    color="primary"
                    variant="outlined"
                />
                {!round.complete && (
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                    <Typography variant="caption" sx={{ color: colorA, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        MODEL A
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, minHeight: 20 }}>
                        {clean(round.textA) || <span style={{ color: '#666' }}>{round.textA ? 'thinking…' : 'waiting…'}</span>}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" sx={{ color: colorB, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        MODEL B
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, minHeight: 20 }}>
                        {clean(round.textB) || <span style={{ color: '#666' }}>{round.textB ? 'thinking…' : 'waiting…'}</span>}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
}

export default function DebatePanel() {
    const [message, setMessage] = useState('');
    const [interjection, setInterjection] = useState('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    const d = useDebateStore();
    const settings = useSettingsStore();

    // Load models on mount
    useEffect(() => {
        // Use the same model list as the main model picker
        window.vibe.listModels().then((models: string[]) => {
            setAvailableModels(models.map(m => `ollama:${m}`));
        }).catch(() => {});

        // Also load cloud models from the kernel
        window.vibe.kernel.cloudModels().then((cloudModels) => {
            const cloud = cloudModels.map(m => m.name);
            setAvailableModels(prev => [...prev, ...cloud]);
        }).catch(() => {});
    }, []);

    const handleStart = () => {
        if (!message.trim()) return;
        d.startDebate(message, [], settings.apiKeys);
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleStart();
        }
    };

    const handleInterject = () => {
        if (!interjection.trim()) return;
        d.interject(interjection);
        setInterjection('');
    };

    return (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ForumIcon fontSize="small" color="primary" />
                <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
                    Model Debate
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <ToggleButtonGroup
                    size="small"
                    value={d.debateEnabled ? 'on' : 'off'}
                    exclusive
                    onChange={(_, v) => d.toggleDebate(v === 'on')}
                >
                    <ToggleButton value="on" size="small">ON</ToggleButton>
                    <ToggleButton value="off" size="small">OFF</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {!d.debateEnabled ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Toggle ON to enable model debate mode
                    </Typography>
                </Box>
            ) : (
                <>
                    {/* Config bar */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Model A</InputLabel>
                            <Select
                                value={d.modelA}
                                label="Model A"
                                onChange={(e) => d.setModelA(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Model B</InputLabel>
                            <Select
                                value={d.modelB}
                                label="Model B"
                                onChange={(e) => d.setModelB(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Rounds</InputLabel>
                            <Select
                                value={d.maxRounds}
                                label="Rounds"
                                onChange={(e) => d.setMaxRounds(Number(e.target.value))}
                                sx={{ fontSize: 13 }}
                            >
                                {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Judge (optional)</InputLabel>
                            <Select
                                value={d.judgeModel}
                                label="Judge (optional)"
                                onChange={(e) => d.setJudgeModel(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                <MenuItem value="" sx={{ fontSize: 13 }}>No synthesis</MenuItem>
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Message input */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            maxRows={3}
                            placeholder="Ask a question for the models to debate…"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
                        />
                        {d.running ? (
                            <IconButton color="error" onClick={() => d.cancelDebate()}>
                                <StopIcon />
                            </IconButton>
                        ) : (
                            <IconButton color="primary" onClick={handleStart} disabled={!message.trim()}>
                                <PlayArrowIcon />
                            </IconButton>
                        )}
                    </Box>

                    {d.error && (
                        <Typography variant="caption" color="error" sx={{ mb: 1 }}>
                            {d.error}
                        </Typography>
                    )}

                    {/* Debate transcript */}
                    <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 1 }}>
                        {d.rounds.map((round, i) => (
                            <RoundView key={i} round={round} />
                        ))}

                        {d.synthesizing && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CircularProgress size={16} />
                                <Typography variant="caption" color="text.secondary">
                                    Synthesizing…
                                </Typography>
                            </Box>
                        )}

                        {d.synthesis && (
                            <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 13 }}>
                                    ⚖️ Synthesized Answer
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
                                    {clean(d.synthesis)}
                                </Typography>
                            </Paper>
                        )}
                    </Box>

                    {/* Interjection bar */}
                    <Collapse in={d.running}>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Interject — send a message to both models mid-debate…"
                                value={interjection}
                                onChange={(e) => setInterjection(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleInterject();
                                    }
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
                            />
                            <Tooltip title="Send interjection">
                                <IconButton
                                    color="secondary"
                                    onClick={handleInterject}
                                    disabled={!interjection.trim()}
                                >
                                    <SendIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Collapse>
                </>
            )}
        </Box>
    );
}