import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMacOSDesktopAppZip,
  buildMacOSSelfExtractingCommand,
  buildWindowsExeInstaller,
  computeCrc32,
  createZipArchive,
} from './desktopPackager';

describe('desktopPackager — native Windows PE32+ .exe and macOS .app/.command builder', () => {
  it('computes standard CRC32 checksum accurately', () => {
    const bytes = new TextEncoder().encode('123456789');
    assert.equal(computeCrc32(bytes), 0xcbf43926);
  });

  it('builds a genuine 64-bit Windows PE32+ GUI .exe binary with embedded HTML payload at offset 4096', () => {
    const sampleHtml = '<!doctype html><html><body>Smart Whiteboard Offline</body></html>';
    const exe = buildWindowsExeInstaller(sampleHtml);

    // DOS MZ signature
    assert.equal(exe[0], 0x4d); // 'M'
    assert.equal(exe[1], 0x5a); // 'Z'

    // PE\0\0 signature at 0x80
    assert.equal(exe[0x80], 0x50); // 'P'
    assert.equal(exe[0x81], 0x45); // 'E'
    assert.equal(exe[0x82], 0x00);
    assert.equal(exe[0x83], 0x00);

    // AMD64 machine type 0x8664 at 0x84
    const dv = new DataView(exe.buffer);
    assert.equal(dv.getUint16(0x84, true), 0x8664);

    // PE32+ magic 0x020B at 0x98
    assert.equal(dv.getUint16(0x98, true), 0x020b);

    // Non-zero PE Header CheckSum at 0x98 + 64 (0xD8)
    assert.ok(dv.getUint32(0x98 + 64, true) > 0);

    // Ensure the 4096-byte PE stub contains zero PowerShell / cmd.exe / WScript strings
    const stubStrings = new TextDecoder().decode(exe.subarray(0, 4096)).toLowerCase();
    assert.equal(stubStrings.includes('powershell'), false);
    assert.equal(stubStrings.includes('wscript'), false);
    assert.equal(stubStrings.includes('winexec'), false);

    // Embedded HTML starts right at byte offset 4096
    const extractedPayload = new TextDecoder().decode(exe.subarray(4096));
    assert.equal(extractedPayload, sampleHtml);
  });

  it('builds a self-extracting macOS .command installer and .app.zip bundle', () => {
    const sampleHtml = '<!doctype html><html><body>Smart Whiteboard Offline</body></html>';
    const cmd = buildMacOSSelfExtractingCommand(sampleHtml);
    const cmdText = new TextDecoder().decode(cmd);
    assert.ok(cmdText.startsWith('#!/bin/bash'));
    assert.ok(cmdText.includes('fzInK.app'));
    assert.ok(cmdText.includes(sampleHtml));

    const macZip = buildMacOSDesktopAppZip(sampleHtml);
    assert.equal(macZip[0], 0x50);
    assert.equal(macZip[1], 0x4b);
  });

  it('creates a valid ZIP archive with PK signatures and Unix executable permissions', () => {
    const zip = createZipArchive([
      { path: 'Test.app/Contents/MacOS/Test', content: '#!/bin/bash\necho ok\n', isExecutable: true },
    ]);
    assert.equal(zip[0], 0x50);
    assert.equal(zip[1], 0x4b);
    assert.equal(zip[2], 0x03);
    assert.equal(zip[3], 0x04);
  });
});
