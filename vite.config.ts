import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          // Generate 100% self-contained single-file offline HTML bundle for Windows & macOS desktop downloads
          const indexHtmlPath = path.resolve(distDir, 'index.html');
          const assetsDir = path.resolve(distDir, 'assets');
          if (fs.existsSync(indexHtmlPath) && fs.existsSync(assetsDir)) {
            let html = fs.readFileSync(indexHtmlPath, 'utf-8');
            const assetFiles = fs.readdirSync(assetsDir);
            const cssFile = assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.css'));
            const jsFile = assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.js'));

            if (cssFile && jsFile) {
              const rawCss = fs
                .readFileSync(path.resolve(assetsDir, cssFile), 'utf-8')
                .replace(/\/assets\/(KaTeX_[^"')]+\.(woff2|woff|ttf))/g, (fullMatch, fileName, ext) => {
                  const fontPath = path.resolve(assetsDir, fileName);
                  if (!fs.existsSync(fontPath)) return fullMatch;
                  const mime =
                    ext === 'woff2'
                      ? 'font/woff2'
                      : ext === 'woff'
                        ? 'font/woff'
                        : 'font/ttf';
                  const b64 = fs.readFileSync(fontPath).toString('base64');
                  return `data:${mime};base64,${b64}`;
                });
              const rawJs = fs
                .readFileSync(path.resolve(assetsDir, jsFile), 'utf-8')
                .replace(/<\/script/gi, '<\\/script');

              html = html.replace(
                /<link[^>]+rel="stylesheet"[^>]+href="\/assets\/index-[^"]+\.css"[^>]*>/i,
                () => `<style>\n${rawCss}\n</style>`
              );
              html = html.replace(
                /<script[^>]+src="\/assets\/index-[^"]+\.js"[^>]*><\/script>/i,
                () => `<script type="module">\n${rawJs}\n</script>`
              );

              const publicBundlePath = path.resolve(__dirname, 'public/desktop-app-bundle.html');
              const distBundlePath = path.resolve(distDir, 'desktop-app-bundle.html');
              fs.writeFileSync(publicBundlePath, html, 'utf-8');
              fs.writeFileSync(distBundlePath, html, 'utf-8');
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
