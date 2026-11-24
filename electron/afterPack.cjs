const { execFileSync } = require('child_process');
const path = require('path');

/**
 * Ad-hoc sign macOS .app bundles when no Apple Developer ID certificate is configured.
 * Modifying Info.plist / Resources during packaging invalidates Electron's default signature,
 * which can cause macOS (especially Apple Silicon) to reject the app as damaged.
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

  console.log(`[afterPack] Ad-hoc signing macOS app: ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  });
};
