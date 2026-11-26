const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function isCodeSigned(targetPath) {
  try {
    execFileSync('codesign', ['--verify', '--strict', targetPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function signPath(targetPath) {
  execFileSync('codesign', ['--force', '--sign', '-', targetPath], {
    stdio: 'inherit',
  });
}

function listFilesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function signFrameworkInsideOut(frameworkPath) {
  const versionsDir = path.join(frameworkPath, 'Versions');
  const roots = [];

  if (fs.existsSync(versionsDir)) {
    for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink() && entry.isDirectory()) {
        roots.push(path.join(versionsDir, entry.name));
      }
    }
  } else {
    roots.push(frameworkPath);
  }

  for (const root of roots) {
    // 1. Sign nested .app / .xpc bundles (e.g. Helpers or Resources)
    for (const subDirName of ['Helpers', 'Resources', 'XPCServices']) {
      const subDir = path.join(root, subDirName);
      if (!fs.existsSync(subDir)) continue;
      for (const entry of fs.readdirSync(subDir, { withFileTypes: true })) {
        if (entry.isDirectory() && (entry.name.endsWith('.app') || entry.name.endsWith('.xpc'))) {
          const nestedBundle = path.join(subDir, entry.name);
          if (!isCodeSigned(nestedBundle)) {
            console.log(`[afterPack] Ad-hoc signing nested bundle: ${nestedBundle}`);
            signPath(nestedBundle);
          }
        }
      }
    }

    // 2. Sign unsigned .dylib and executable helper binaries (e.g. Squirrel's ShipIt)
    for (const filePath of listFilesRecursive(root)) {
      if (filePath.includes('.app/') || filePath.includes('.xpc/')) continue;
      const stat = fs.statSync(filePath);
      const isDylib = filePath.endsWith('.dylib') || filePath.endsWith('.so');
      const isExec = (stat.mode & 0o111) !== 0;
      const isFrameworkMainBinary = path.dirname(filePath) === root;
      if ((isDylib || (isExec && !isFrameworkMainBinary)) && !isCodeSigned(filePath)) {
        console.log(`[afterPack] Ad-hoc signing binary: ${filePath}`);
        signPath(filePath);
      }
    }
  }

  console.log(`[afterPack] Ad-hoc signing framework: ${frameworkPath}`);
  signPath(frameworkPath);
}

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

  if (fs.existsSync(frameworksDir)) {
    const entries = fs.readdirSync(frameworksDir, { withFileTypes: true });

    // 1. Ensure all nested .framework bundles (such as Squirrel.framework on x64) are signed.
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith('.framework')) {
        const frameworkPath = path.join(frameworksDir, entry.name);
        if (!isCodeSigned(frameworkPath)) {
          signFrameworkInsideOut(frameworkPath);
        }
      }
    }

    // 2. Sign any unsigned standalone dylibs directly inside Contents/Frameworks.
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.dylib')) {
        const dylibPath = path.join(frameworksDir, entry.name);
        if (!isCodeSigned(dylibPath)) {
          console.log(`[afterPack] Ad-hoc signing dylib: ${entry.name}`);
          signPath(dylibPath);
        }
      }
    }

    // 3. Re-sign the renamed Helper .app bundles (without --deep), preserving Electron Framework.
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith('.app')) {
        const helperAppPath = path.join(frameworksDir, entry.name);
        console.log(`[afterPack] Ad-hoc signing helper: ${entry.name}`);
        signPath(helperAppPath);
      }
    }
  }

  // 4. Re-sign the outer .app bundle last (without --deep).
  console.log(`[afterPack] Ad-hoc signing macOS app: ${appPath}`);
  signPath(appPath);
};
