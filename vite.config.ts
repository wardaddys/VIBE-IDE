import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

delete process.env.ELECTRON_RUN_AS_NODE;

// Strict CSP for the PACKAGED renderer only. It blocks inline/`javascript:`
// script execution (defense-in-depth behind the markdown link sanitizer) while
// still allowing what the app needs: Monaco web-workers (blob:), emotion/MUI
// inline styles, and model API calls (connect-src https:). Injected on build
// only so Vite dev + react-refresh (which use inline scripts) keep working.
const PROD_CSP = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
].join('; ');

function cspPlugin() {
    return {
        name: 'vibe-csp',
        apply: 'build' as const,
        transformIndexHtml(html: string) {
            return html.replace(
                '</head>',
                `  <meta http-equiv="Content-Security-Policy" content="${PROD_CSP}">\n  </head>`,
            );
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    // No inline module-preload polyfill: it injects an inline <script> that the
    // prod CSP (script-src 'self') would block. Electron/Chromium supports
    // modulepreload natively, so the polyfill is unnecessary here.
    build: { modulePreload: { polyfill: false } },
    plugins: [
        cspPlugin(),
        react(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'src/main/index.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron', 'node-pty', 'node:path', 'node:url', 'node:fs', 'node:fs/promises', 'node:os', 'node:child_process', 'node:crypto', 'node:net', 'node:stream']
                        }
                    }
                }
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, 'src/main/preload.ts'),
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron']
                        }
                    }
                }
            },
            // Ployfill the Electron and Node.js built-in modules for Renderer process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: {},
        }),
    ],
})
