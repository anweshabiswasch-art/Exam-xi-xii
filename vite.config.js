import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            // injectManifest (rather than the simpler generateSW) is required
            // here because push notifications need custom service worker code
            // (self.addEventListener('push', ...)) — see src/sw.ts.
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
            },
            manifest: {
                name: 'WordCraft XI-XII English MCQ Academy',
                short_name: 'WordCraft',
                description: 'WBCHSE Class XI-XII English MCQ practice, exams and AI-powered explanations.',
                theme_color: '#16294B',
                background_color: '#FBF9F4',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: 'icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                shortcuts: [
                    {
                        name: 'Start a Test',
                        url: '/test/setup',
                        description: 'Begin a new practice test',
                    },
                    {
                        name: 'Dashboard',
                        url: '/dashboard',
                        description: 'View your progress',
                    },
                ],
            },
            devOptions: {
                enabled: false,
                type: 'module',
            },
        }),
    ],
    server: {
        port: 5173,
    },
});
