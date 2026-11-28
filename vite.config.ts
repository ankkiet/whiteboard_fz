import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import {createRequire} from 'module';
import path from 'path';
import {defineConfig} from 'vite';

const require = createRequire(import.meta.url);
const otaUpdater = require('./electron/otaUpdater.cjs');

function readEffectiveReleaseConfig() {
  const pkgPath = path.resolve(__dirname, 'package.json');
  const versionCfgPath = path.resolve(__dirname, 'version.json');
  let nativeVersion = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg && typeof pkg.version === 'string' && pkg.version.trim()) {
      nativeVersion = pkg.version.trim();
    }
  } catch {
    // ignore
  }

  let cfg: {version?: string; minNativeVersion?: string; notes?: string} = {};
  try {
    if (fs.existsSync(versionCfgPath)) {
      cfg = JSON.parse(fs.readFileSync(versionCfgPath, 'utf-8'));
    }
  } catch {
    // ignore
  }

  const cfgMinNative = typeof cfg.minNativeVersion === 'string' ? cfg.minNativeVersion.trim() : '';
  const cfgVersion = typeof cfg.version === 'string' ? cfg.version.trim() : '';
  const minNativeVersion =
    cfgMinNative && otaUpdater.compareVersions(cfgMinNative, nativeVersion) >= 0
      ? cfgMinNative
      : nativeVersion;
  const version =
    cfgVersion && otaUpdater.compareVersions(cfgVersion, nativeVersion) >= 0
      ? cfgVersion
      : nativeVersion;
  const notes = typeof cfg.notes === 'string' ? cfg.notes.trim() : '';

  return {version, nativeVersion, minNativeVersion, notes};
}

export default defineConfig(() => {
  return {
    base: './',
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
                .replace(/(?:\.\/|\/)?assets\/(KaTeX_[^"')]+\.(woff2|woff|ttf))/g, (fullMatch, fileName, ext) => {
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

              const buildId = crypto
                .createHash('sha256')
                .update(rawCss)
                .update(rawJs)
                .digest('hex')
                .slice(0, 12);

              const releaseConfig = readEffectiveReleaseConfig();
              const embeddedManifest = {
                version: releaseConfig.version,
                buildId,
                nativeVersion: releaseConfig.nativeVersion,
                minNativeVersion: releaseConfig.minNativeVersion,
                notes: releaseConfig.notes,
                updateOrigin: 'https://whiteboardfz.pages.dev',
              };

              const versionMetaScript = `<script>window.__BTTM_EMBEDDED_BUILD__=${JSON.stringify(embeddedManifest)};</script>`;

              // Inject version manifest directly into dist/index.html so Electron packaged app & OTA builds always know their version and buildId
              if (fs.existsSync(indexHtmlPath)) {
                let distHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
                if (!distHtml.includes('__BTTM_EMBEDDED_BUILD__')) {
                  distHtml = distHtml.replace('<head>', `<head>\n    ${versionMetaScript}`);
                  fs.writeFileSync(indexHtmlPath, distHtml, 'utf-8');
                }
              }

              // Package dist/ into web-update.zip for fast 2-tier OTA desktop updates
              const otaZipPath = path.resolve(distDir, 'web-update.zip');
              if (fs.existsSync(otaZipPath)) {
                fs.unlinkSync(otaZipPath);
              }
              const otaArchive = otaUpdater.createZipFromDirectory(distDir, otaZipPath, {
                exclude: (relPosix: string) =>
                  relPosix === 'web-update.zip' ||
                  relPosix === 'desktop-app-bundle.html' ||
                  relPosix === 'app-version.json' ||
                  relPosix === 'app-version.js' ||
                  relPosix === 'sw.js' ||
                  relPosix === '_headers' ||
                  relPosix === '_redirects' ||
                  relPosix.startsWith('demo/') ||
                  relPosix.startsWith('assets/aistudio/'),
              });

              const versionManifest = {
                ...embeddedManifest,
                otaBundleUrl: 'web-update.zip',
                otaBundleSha256: otaArchive.sha256,
                otaBundleSize: otaArchive.sizeBytes,
              };

              const jsChunkNames = assetFiles.filter((f) => f.endsWith('.js') && f !== jsFile);
              let bundleJs = rawJs;
              for (const chunkName of jsChunkNames) {
                const absUrl = `${versionManifest.updateOrigin}/assets/${chunkName}`;
                bundleJs = bundleJs
                  .split(`"./${chunkName}"`)
                  .join(`"${absUrl}"`)
                  .split(`'./${chunkName}'`)
                  .join(`'${absUrl}'`);
              }

              html = html.replace(
                /<link[^>]+rel="modulepreload"[^>]*>\s*/gi,
                ''
              );
              html = html.replace(
                /<link[^>]+rel="stylesheet"[^>]+href="(?:\.\/|\/)?assets\/index-[^"]+\.css"[^>]*>/i,
                () => `${versionMetaScript}\n<style>\n${rawCss}\n</style>`
              );
              html = html.replace(
                /<script[^>]+src="(?:\.\/|\/)?assets\/index-[^"]+\.js"[^>]*><\/script>/i,
                () => `<script type="module">\n${bundleJs}\n</script>`
              );

              const publicBundlePath = path.resolve(__dirname, 'public/desktop-app-bundle.html');
              const distBundlePath = path.resolve(distDir, 'desktop-app-bundle.html');
              fs.writeFileSync(publicBundlePath, html, 'utf-8');
              fs.writeFileSync(distBundlePath, html, 'utf-8');

              const versionJson = JSON.stringify(versionManifest, null, 2);
              fs.writeFileSync(path.resolve(__dirname, 'public/app-version.json'), versionJson, 'utf-8');
              fs.writeFileSync(path.resolve(distDir, 'app-version.json'), versionJson, 'utf-8');

              const versionJsonp = `window.__BTTM_VERSION_CALLBACK__&&window.__BTTM_VERSION_CALLBACK__(${JSON.stringify(versionManifest)});\n`;
              fs.writeFileSync(path.resolve(__dirname, 'public/app-version.js'), versionJsonp, 'utf-8');
              fs.writeFileSync(path.resolve(distDir, 'app-version.js'), versionJsonp, 'utf-8');
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
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    },
    preview: {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    },
  };
});
