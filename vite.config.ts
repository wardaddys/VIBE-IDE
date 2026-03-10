import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

delete process.env.ELECTRON_RUN_AS_NODE;

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'src/main/index.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron', 'node-pty', 'node:path', 'node:url', 'node:fs', 'node:fs/promises', 'node:os', 'node:child_process']
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
