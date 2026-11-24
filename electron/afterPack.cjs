const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Ad-hoc sign macOS .app bundles inside-out (NEVER using --deep) when no Apple Developer ID
 * certificate is configured.
 *
 * Avoids `codesign --deep`, which overwrites nested Electron Framework / dylib signatures
 * and can trigger EXC_BREAKPOINT (SIGTRAP) crashes during Chromium startup on macOS.
 */
exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin' || context.electronPlatformName !== 'darwin') {
    return;
  }

  // If a real signing certificate is configured, let electron-builder handle signing.
  if (process.env.CSC_LINK) {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

  // 1. Re-sign only the renamed Helper .app bundles (without --deep), preserving Electron Framework.
  if (fs.existsSync(frameworksDir)) {
    const entries = fs.readdirSync(frameworksDir);
    for (const entry of entries) {
      if (entry.endsWith('.app')) {
        const helperAppPath = path.join(frameworksDir, entry);
        console.log(`[afterPack] Ad-hoc signing helper: ${entry}`);
        execFileSync('codesign', ['--force', '--sign', '-', helperAppPath], {
          stdio: 'inherit',
        });
      }
    }
  }

  // 2. Re-sign the outer .app bundle last (without --deep).
  console.log(`[afterPack] Ad-hoc signing macOS app: ${appPath}`);
  execFileSync('codesign', ['--force', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
