import React, { useEffect, useRef, useState, useCallback } from 'react'

interface AgentStatus {
  collector: {
    isRunning: boolean
    eventCount: number
    lastEventTime: number | null
    isDistilling: boolean
    lastDistillTime: number | null
  }
  reviewer: {
    isRunning: boolean
    isSynthesizing: boolean
    lastBriefingTime: number
    briefingCount: number
  }
}

export function NeuralWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const statusRef = useRef<AgentStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<AgentStatus | null>(null)

  // Poll agent status every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await window.vibe.getAgentStatus()
        setStatus(s)
        statusRef.current = s
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = 200
    const H = canvas.height = 90

    // Internal simulation state
    let sparks: Array<{
      t: number; speed: number; arc: number
      size: number; trail: Array<{x:number;y:number}>; hue: number
    }> = []
    let shockwaves: Array<{x:number;y:number;r:number;maxR:number;t:number;hue:number}> = []
    let lastEventCount = 0
    let lastSynthesizing = false
    let reviewerGlow = 0
    let collectorFlare = 0
    let synapseFlow = 0

    const N1 = { x: 45, y: H / 2 }
    const N2 = { x: W - 45, y: H / 2 }
    const NR = 18

    function spawnSparks() {
      for (let i = 0; i < 4; i++) {
        sparks.push({
          t: 0,
          speed: 0.012 + Math.random() * 0.015,
          arc: (Math.random() - 0.5) * 1.0,
          size: 1.5 + Math.random() * 2,
          trail: [],
          hue: 195 + Math.random() * 30
        })
      }
    }

    function spawnShockwave(x: number, y: number, hue: number) {
      shockwaves.push({ x, y, r: NR, maxR: NR + 35, t: 0, hue })
    }

    function lerp(a: number, b: number, t: number) { return a + (b-a)*t }
    function ease(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

    function draw() {
      tRef.current += 0.018
      const T = tRef.current
      const s = statusRef.current

      // Check for new events
      if (s) {
        if (s.collector.eventCount > lastEventCount) {
          lastEventCount = s.collector.eventCount
          collectorFlare = 1
          synapseFlow = Math.min(1, synapseFlow + 0.5)
          spawnSparks()
          spawnShockwave(N1.x, N1.y, 210)
        }
        if (s.reviewer.isSynthesizing && !lastSynthesizing) {
          reviewerGlow = 1
          synapseFlow = 1
          spawnShockwave(N2.x, N2.y, 165)
        }
        lastSynthesizing = s.reviewer.isSynthesizing
      }

      // Decay
      collectorFlare = Math.max(0, collectorFlare - 0.03)
      reviewerGlow = Math.max(0, reviewerGlow - 0.012)
      synapseFlow = Math.max(0, synapseFlow - 0.01)

      // Clear with deep space bg
      ctx.fillStyle = '#070a14'
      ctx.fillRect(0, 0, W, H)

      // Subtle nebula
      const ng = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 80)
      ng.addColorStop(0, 'rgba(40,80,180,0.06)')
      ng.addColorStop(1, 'transparent')
      ctx.fillStyle = ng
      ctx.fillRect(0, 0, W, H)

      // Neural bridge
      const x1 = N1.x + NR, x2 = N2.x - NR
      ctx.beginPath()
      ctx.moveTo(x1, H/2)
      ctx.lineTo(x2, H/2)
      ctx.strokeStyle = 'rgba(60,120,255,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      if (synapseFlow > 0.1) {
        for (let strand = 0; strand < 2; strand++) {
          ctx.beginPath()
          for (let i = 0; i <= 40; i++) {
            const f = i/40
            const x = lerp(x1, x2, f)
            const wave = Math.sin(f * Math.PI * 5 - T * 7 + strand * 1.5) * 7 * synapseFlow
            if (i===0) ctx.moveTo(x, H/2+wave)
            else ctx.lineTo(x, H/2+wave)
          }
          ctx.strokeStyle = `hsla(${185+strand*20},100%,70%,${0.45*synapseFlow})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Shockwaves
      shockwaves = shockwaves.filter(sw => sw.t < 1)
      for (const sw of shockwaves) {
        sw.t += 0.025
        const r = lerp(sw.r, sw.maxR, ease(sw.t))
        const alpha = (1 - sw.t) * 0.55
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, r, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${sw.hue},100%,70%,${alpha})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Sparks
      sparks = sparks.filter(sp => sp.t < 1)
      for (const sp of sparks) {
        sp.t += sp.speed
        const f = ease(sp.t)
        const x = lerp(x1, x2, f)
        const y = H/2 + Math.sin(sp.t * Math.PI) * 25 * sp.arc
        sp.trail.push({x,y})
        if (sp.trail.length > 6) sp.trail.shift()
        const alpha = Math.sin(sp.t * Math.PI)
        for (let i = 0; i < sp.trail.length; i++) {
          const tp = sp.trail[i]
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, sp.size * (i/sp.trail.length) * 0.8, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${sp.hue},100%,80%,${(i/sp.trail.length)*alpha*0.7})`
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(x, y, sp.size, 0, Math.PI*2)
        ctx.fillStyle = `hsla(${sp.hue},100%,95%,${alpha})`
        ctx.fill()
      }

      // Draw node function
      const drawNode = (
        nx: number, ny: number,
        phase: number, flare: number,
        hue1: number, hue2: number
      ) => {
        const breathe = 1 + 0.07 * Math.sin(phase)
        const r = NR * breathe
        const glow = 0.25 + flare * 0.75

        // Outer glow
        for (let i = 3; i >= 1; i--) {
          const gr = ctx.createRadialGradient(nx,ny,0,nx,ny,r*(1+i*0.55))
          gr.addColorStop(0, `hsla(${hue1},100%,65%,${0.05*glow*i*0.25})`)
          gr.addColorStop(1,'transparent')
          ctx.beginPath()
          ctx.arc(nx, ny, r*(1+i*0.55), 0, Math.PI*2)
          ctx.fillStyle = gr
          ctx.fill()
        }

        // Orbital ring
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(phase * 0.35)
        ctx.beginPath()
        ctx.ellipse(0, 0, r*1.55, r*0.35, 0, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${hue2},100%,75%,${0.18*glow})`
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.restore()

        // Core
        const cg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.3,r*0.05,nx,ny,r)
        cg.addColorStop(0, `hsla(${hue1},50%,96%,1)`)
        cg.addColorStop(0.35, `hsla(${hue1},90%,68%,1)`)
        cg.addColorStop(0.75, `hsla(${hue2},100%,42%,1)`)
        cg.addColorStop(1, `hsla(${hue2},100%,18%,1)`)
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = cg
        ctx.fill()

        // Specular
        const sg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.32,0,nx-r*0.2,ny-r*0.2,r*0.55)
        sg.addColorStop(0,'rgba(255,255,255,0.45)')
        sg.addColorStop(1,'transparent')
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = sg
        ctx.fill()

        // Flare rays
        if (flare > 0.25) {
          for (let i = 0; i < 10; i++) {
            const angle = (i/10)*Math.PI*2 + phase
            const len = r*(0.6+0.4*Math.sin(angle*3+T*3))*flare
            ctx.beginPath()
            ctx.moveTo(nx+Math.cos(angle)*r, ny+Math.sin(angle)*r)
            ctx.lineTo(nx+Math.cos(angle)*(r+len), ny+Math.sin(angle)*(r+len))
            ctx.strokeStyle = `hsla(${hue1},100%,88%,${0.4*flare})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      drawNode(N1.x, N1.y, T*1.1, collectorFlare, 210, 235)
      drawNode(N2.x, N2.y, T*0.65+1.8, reviewerGlow, 162, 190)

      // Labels
      ctx.font = '8px SF Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(150,180,255,${0.45 + collectorFlare*0.4})`
      ctx.fillText('collector', N1.x, H - 8)
      ctx.fillStyle = `rgba(100,220,175,${0.45 + reviewerGlow*0.4})`
      ctx.fillText('reviewer', N2.x, H - 8)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const formatTime = (ms: number | null) => {
    if (!ms) return '—'
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s/60)}m ago`
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 220,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 8,
      pointerEvents: 'auto'
    }}>
      {expanded && status && (
        <div style={{
          background: 'rgba(7,10,20,0.95)',
          border: '1px solid rgba(60,120,255,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          minWidth: 220,
          backdropFilter: 'blur(16px)',
          fontFamily: 'SF Mono, monospace',
          fontSize: 11,
          color: 'rgba(180,210,255,0.85)',
          lineHeight: 1.9
        }}>
          <div style={{ color: 'rgba(100,160,255,0.6)', fontSize: 9, letterSpacing: '0.2em', marginBottom: 8 }}>
            VIBE NEURAL AGENTS
          </div>
          <div style={{ borderBottom: '1px solid rgba(60,120,255,0.15)', paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ color: 'rgba(100,180,255,0.9)', fontWeight: 600, marginBottom: 2 }}>
              ◆ Collector
            </div>
            <div>events: {status.collector.eventCount}</div>
            <div>last event: {formatTime(status.collector.lastEventTime)}</div>
            <div>distilling: {status.collector.isDistilling ? '⚡ active' : 'idle'}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(80,220,160,0.9)', fontWeight: 600, marginBottom: 2 }}>
              ◆ Reviewer
            </div>
            <div>briefings: {status.reviewer.briefingCount}</div>
            <div>last briefing: {formatTime(status.reviewer.lastBriefingTime || null)}</div>
            <div>synthesizing: {status.reviewer.isSynthesizing ? '⚡ active' : 'idle'}</div>
          </div>
        </div>
      )}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', lineHeight: 0 }}
        title="VIBE Neural Agents"
      >
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(60,120,255,0.2)',
            display: 'block'
          }}
        />
      </div>
    </div>
  )
}
