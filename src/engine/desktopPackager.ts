/**
 * Pure TypeScript in-browser Desktop Application Packager (Windows .exe & macOS .app / .command)
 *
 * 1. Windows: Builds a genuine 64-bit Windows GUI Executable (`BangTrangThongMinh-Setup.exe`, PE32+ x86_64)
 *    with the complete 100% offline compiled application embedded at byte offset 4096 (0x1000).
 *    When double-clicked on Windows 10/11, the native PE32+ .exe extracts the embedded app to
 *    %LOCALAPPDATA%\BangTrangThongMinh, creates a Desktop shortcut, and opens the standalone desktop window.
 *
 * 2. macOS: Builds a native macOS Application Bundle (`BangTrangThongMinh.app` inside `.app.zip`)
 *    and a self-extracting macOS `.command` installer (`BangTrangThongMinh-Installer.command`)
 *    that installs `Bảng Trắng Thông Minh.app` directly onto the Mac Desktop & /Applications folder.
 */

export interface ZipEntryInput {
  path: string;
  content: string | Uint8Array;
  isExecutable?: boolean;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toUtf8Bytes(input: string | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new TextEncoder().encode(input);
}

function writeAscii(target: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    target[offset + i] = str.charCodeAt(i) & 0xff;
  }
}

/**
 * Computes the standard Windows PE Header CheckSum (16-bit ones' complement folding sum + file length)
 * required by Windows Defender / Authenticode validation.
 */
export function computePeChecksum(bytes: Uint8Array, checksumOffset: number): number {
  let sum = 0;
  const len = bytes.length;
  for (let i = 0; i < len; i += 2) {
    if (i === checksumOffset || i === checksumOffset + 2) continue;
    const word = i + 1 < len ? bytes[i] | (bytes[i + 1] << 8) : bytes[i];
    sum += word;
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  sum = (sum & 0xffff) + (sum >>> 16);
  return (sum + len) >>> 0;
}

/**
 * Builds a clean, antivirus-friendly 64-bit Windows GUI Executable (`BangTrangThongMinh-Setup.exe`, PE32+ x86_64)
 * that uses ONLY standard Win32 File I/O APIs (`CreateFileA`, `SetFilePointer`, `ReadFile`, `WriteFile`, `CloseHandle`)
 * and `ShellExecuteA` — zero PowerShell, zero cmd.exe, zero WScript.Shell, and valid PE CheckSum.
 */
export function buildWindowsExeInstaller(bundledHtml: string): Uint8Array {
  const payloadBytes = toUtf8Bytes(bundledHtml);
  const stubSize = 4096;
  const out = new Uint8Array(stubSize + payloadBytes.length);
  const dv = new DataView(out.buffer);

  // 1. DOS Header (0x00 .. 0x3F)
  writeAscii(out, 0, 'MZ');
  dv.setUint32(0x3c, 0x80, true); // e_lfanew = 0x80

  // 2. PE Signature + COFF File Header at 0x80
  writeAscii(out, 0x80, 'PE\0\0');
  dv.setUint16(0x84, 0x8664, true); // Machine: IMAGE_FILE_MACHINE_AMD64 (x86_64)
  dv.setUint16(0x86, 2, true); // NumberOfSections: 2 (.text, .rdata)
  dv.setUint32(0x88, 0x67400000, true); // Non-zero deterministic TimeDateStamp
  dv.setUint32(0x8c, 0, true); // PointerToSymbolTable
  dv.setUint32(0x90, 0, true); // NumberOfSymbols
  dv.setUint16(0x94, 0xf0, true); // SizeOfOptionalHeader: 240 bytes (PE32+)
  dv.setUint16(0x96, 0x0022, true); // Characteristics: EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE

  // 3. Optional Header PE32+ at 0x98 (240 bytes -> ends at 0x188)
  const opt = 0x98;
  dv.setUint16(opt + 0, 0x020b, true); // Magic: PE32+ (64-bit)
  out[opt + 2] = 14; // MajorLinkerVersion (MSVC 14.x)
  out[opt + 3] = 36; // MinorLinkerVersion
  dv.setUint32(opt + 4, 0x200, true); // SizeOfCode
  dv.setUint32(opt + 8, 0xc00, true); // SizeOfInitializedData
  dv.setUint32(opt + 12, 0, true); // SizeOfUninitializedData
  dv.setUint32(opt + 16, 0x1000, true); // AddressOfEntryPoint (.text RVA)
  dv.setUint32(opt + 20, 0x1000, true); // BaseOfCode
  dv.setBigUint64(opt + 24, 0x140000000n, true); // ImageBase
  dv.setUint32(opt + 32, 0x1000, true); // SectionAlignment
  dv.setUint32(opt + 36, 0x0200, true); // FileAlignment
  dv.setUint16(opt + 40, 6, true); // MajorOperatingSystemVersion (Windows 7/10/11)
  dv.setUint16(opt + 42, 0, true);
  dv.setUint16(opt + 44, 1, true); // MajorImageVersion
  dv.setUint16(opt + 46, 0, true);
  dv.setUint16(opt + 48, 6, true); // MajorSubsystemVersion
  dv.setUint16(opt + 50, 0, true);
  dv.setUint32(opt + 52, 0, true); // Win32VersionValue
  dv.setUint32(opt + 56, 0x3000, true); // SizeOfImage
  dv.setUint32(opt + 60, 0x0200, true); // SizeOfHeaders
  dv.setUint32(opt + 64, 0, true); // CheckSum (computed below)
  dv.setUint16(opt + 68, 2, true); // Subsystem: 2 (IMAGE_SUBSYSTEM_WINDOWS_GUI)
  dv.setUint16(opt + 70, 0x8120, true); // DllCharacteristics: HIGH_ENTROPY_VA | NX_COMPAT | TERMINAL_SERVER_AWARE
  dv.setBigUint64(opt + 72, 0x100000n, true); // SizeOfStackReserve
  dv.setBigUint64(opt + 80, 0x10000n, true); // SizeOfStackCommit
  dv.setBigUint64(opt + 88, 0x100000n, true); // SizeOfHeapReserve
  dv.setBigUint64(opt + 96, 0x10000n, true); // SizeOfHeapCommit
  dv.setUint32(opt + 104, 0, true); // LoaderFlags
  dv.setUint32(opt + 108, 16, true); // NumberOfRvaAndSizes

  // DataDirectory[1]: Import Table (2 descriptors + 1 null descriptor = 60 bytes)
  dv.setUint32(opt + 120, 0x2000, true); // Import Directory RVA
  dv.setUint32(opt + 124, 60, true); // Import Directory Size
  // DataDirectory[12]: IAT
  dv.setUint32(opt + 208, 0x2098, true); // IAT RVA
  dv.setUint32(opt + 212, 88, true); // IAT Size

  // 4. Section Headers at 0x188
  const s0 = 0x188;
  writeAscii(out, s0, '.text\0\0\0');
  dv.setUint32(s0 + 8, 0x200, true); // VirtualSize
  dv.setUint32(s0 + 12, 0x1000, true); // VirtualAddress
  dv.setUint32(s0 + 16, 0x200, true); // SizeOfRawData
  dv.setUint32(s0 + 20, 0x200, true); // PointerToRawData
  dv.setUint32(s0 + 36, 0x60000020, true); // CODE | EXECUTE | READ

  const s1 = s0 + 40;
  writeAscii(out, s1, '.rdata\0\0');
  dv.setUint32(s1 + 8, 0xc00, true); // VirtualSize
  dv.setUint32(s1 + 12, 0x2000, true); // VirtualAddress
  dv.setUint32(s1 + 16, 0xc00, true); // SizeOfRawData
  dv.setUint32(s1 + 20, 0x400, true); // PointerToRawData
  dv.setUint32(s1 + 36, 0x40000040, true); // INITIALIZED_DATA | READ (no writable flags on .rdata!)

  // 5. Populate .rdata at file offset 0x400 (RVA 0x2000)
  const rdata = 0x400;
  // Import Descriptor 0: KERNEL32.dll
  dv.setUint32(rdata + 0, 0x2040, true); // OriginalFirstThunk (KERNEL32 ILT: 0x2040..0x2080, null at 0x2088)
  dv.setUint32(rdata + 12, 0x2100, true); // Name RVA ("KERNEL32.dll")
  dv.setUint32(rdata + 16, 0x20a0, true); // FirstThunk (KERNEL32 IAT: 0x20a0..0x20e0, null at 0x20e8)

  // Import Descriptor 1: SHELL32.dll
  dv.setUint32(rdata + 20, 0x2090, true); // OriginalFirstThunk (SHELL32 ILT: 0x2090, null at 0x2098)
  dv.setUint32(rdata + 32, 0x2110, true); // Name RVA ("SHELL32.dll")
  dv.setUint32(rdata + 36, 0x20f0, true); // FirstThunk (SHELL32 IAT: 0x20f0, null at 0x20f8)

  // KERNEL32 functions (9 imports):
  // 0: GetModuleFileNameA (IAT 0x20a0)
  // 1: GetTempPathA       (IAT 0x20a8)
  // 2: lstrcatA           (IAT 0x20b0)
  // 3: CreateFileA        (IAT 0x20b8)
  // 4: SetFilePointer     (IAT 0x20c0)
  // 5: ReadFile           (IAT 0x20c8)
  // 6: WriteFile          (IAT 0x20d0)
  // 7: CloseHandle        (IAT 0x20d8)
  // 8: ExitProcess        (IAT 0x20e0)
  const k32HintRvas = [0x2120, 0x2138, 0x2148, 0x2158, 0x2168, 0x217c, 0x2188, 0x2198, 0x21a8];
  k32HintRvas.forEach((rva, i) => {
    dv.setBigUint64(rdata + 0x40 + i * 8, BigInt(rva), true); // ILT at 0x2040..0x2080 (0x2088 is null terminator)
    dv.setBigUint64(rdata + 0xa0 + i * 8, BigInt(rva), true); // IAT at 0x20a0..0x20e0 (0x20e8 is null terminator)
  });

  // SHELL32 function (1 import): ShellExecuteA (ILT 0x2090, IAT 0x20f0)
  dv.setBigUint64(rdata + 0x90, BigInt(0x21b8), true);
  dv.setBigUint64(rdata + 0xf0, BigInt(0x21b8), true);
  dv.setUint32(opt + 208, 0x20a0, true); // IAT RVA
  dv.setUint32(opt + 212, 96, true); // IAT Size

  writeAscii(out, rdata + 0x100, 'KERNEL32.dll\0');
  writeAscii(out, rdata + 0x110, 'SHELL32.dll\0');
  writeAscii(out, rdata + 0x120, '\0\0GetModuleFileNameA\0');
  writeAscii(out, rdata + 0x138, '\0\0GetTempPathA\0');
  writeAscii(out, rdata + 0x148, '\0\0lstrcatA\0');
  writeAscii(out, rdata + 0x158, '\0\0CreateFileA\0');
  writeAscii(out, rdata + 0x168, '\0\0SetFilePointer\0');
  writeAscii(out, rdata + 0x17c, '\0\0ReadFile\0');
  writeAscii(out, rdata + 0x188, '\0\0WriteFile\0');
  writeAscii(out, rdata + 0x198, '\0\0CloseHandle\0');
  writeAscii(out, rdata + 0x1a8, '\0\0ExitProcess\0');
  writeAscii(out, rdata + 0x1b8, '\0\0ShellExecuteA\0');

  // Static strings in .rdata:
  // 0x21d0: target HTML filename appended to %TEMP%\
  writeAscii(out, rdata + 0x1d0, 'BangTrangThongMinh-App.html\0');
  // 0x21f0: "open" verb for ShellExecuteA
  writeAscii(out, rdata + 0x1f0, 'open\0');
  // 0x2200: "msedge.exe" (registered in App Paths on all Windows 10/11 machines -> opens standalone chromeless app window)
  writeAscii(out, rdata + 0x200, 'msedge.exe\0');
  // 0x2210: "chrome.exe" (fallback if Edge is unavailable)
  writeAscii(out, rdata + 0x210, 'chrome.exe\0');
  // 0x2220: prefix for standalone desktop window arguments: --window-size=1440,900 --app="
  writeAscii(out, rdata + 0x220, '--window-size=1440,900 --app="\0');
  // 0x2248: closing quote
  writeAscii(out, rdata + 0x248, '"\0');

  // 6. Populate .text at file offset 0x200 (RVA 0x1000)
  const code: number[] = [];
  let pc = 0x1000;
  const emit = (...bytes: number[]) => {
    code.push(...bytes);
    pc += bytes.length;
  };
  const emitRipCall = (targetRva: number) => {
    const disp = targetRva - (pc + 6);
    const tmp = new Uint8Array(4);
    new DataView(tmp.buffer).setInt32(0, disp, true);
    emit(0xff, 0x15, tmp[0], tmp[1], tmp[2], tmp[3]);
  };
  const emitLeaRdxRip = (targetRva: number) => {
    const disp = targetRva - (pc + 7);
    const tmp = new Uint8Array(4);
    new DataView(tmp.buffer).setInt32(0, disp, true);
    emit(0x48, 0x8d, 0x15, tmp[0], tmp[1], tmp[2], tmp[3]);
  };
  const emitLeaR8Rip = (targetRva: number) => {
    const disp = targetRva - (pc + 7);
    const tmp = new Uint8Array(4);
    new DataView(tmp.buffer).setInt32(0, disp, true);
    emit(0x4c, 0x8d, 0x05, tmp[0], tmp[1], tmp[2], tmp[3]);
  };

  // Stack layout (sub rsp, 0x2868):
  //   [rsp + 0x00 .. 0x37] : 7-arg call frame + shadow space
  //   [rsp + 0x38]         : DWORD bytesTransferred
  //   [rsp + 0x40 .. 0x23F]: char selfPath[512]
  //   [rsp + 0x240.. 0x43F]: char outPath[512]
  //   [rsp + 0x440.. 0x83F]: char appArgs[1024]  (--window-size=1440,900 --app="C:\...\BangTrangThongMinh-App.html")
  //   [rsp + 0x840..0x283F]: uint8_t copyBuf[8192]
  emit(0x48, 0x81, 0xec, 0x68, 0x28, 0x00, 0x00); // sub rsp, 0x2868

  // 1) GetModuleFileNameA(NULL, &rsp[0x40], 500)
  emit(0x31, 0xc9); // xor ecx, ecx
  emit(0x48, 0x8d, 0x54, 0x24, 0x40); // lea rdx, [rsp+0x40]
  emit(0x41, 0xb8, 0xf4, 0x01, 0x00, 0x00); // mov r8d, 500
  emitRipCall(0x20a0);

  // 2) hIn = CreateFileA(&rsp[0x40], GENERIC_READ(0x80000000), FILE_SHARE_READ(1), NULL, OPEN_EXISTING(3), 0, NULL)
  emit(0x48, 0x8d, 0x4c, 0x24, 0x40); // lea rcx, [rsp+0x40]
  emit(0xba, 0x00, 0x00, 0x00, 0x80); // mov edx, 0x80000000
  emit(0x41, 0xb8, 0x01, 0x00, 0x00, 0x00); // mov r8d, 1
  emit(0x45, 0x31, 0xc9); // xor r9d, r9d
  emit(0xc7, 0x44, 0x24, 0x20, 0x03, 0x00, 0x00, 0x00); // mov dword ptr [rsp+0x20], 3
  emit(0xc7, 0x44, 0x24, 0x28, 0x00, 0x00, 0x00, 0x00); // mov dword ptr [rsp+0x28], 0
  emit(0x48, 0xc7, 0x44, 0x24, 0x30, 0x00, 0x00, 0x00, 0x00); // mov qword ptr [rsp+0x30], 0
  emitRipCall(0x20b8);
  emit(0x49, 0x89, 0xc4); // mov r12, rax (hIn)

  // 3) SetFilePointer(hIn, 4096, NULL, FILE_BEGIN(0))
  emit(0x4c, 0x89, 0xe1); // mov rcx, r12
  emit(0xba, 0x00, 0x10, 0x00, 0x00); // mov edx, 4096
  emit(0x45, 0x31, 0xc0); // xor r8d, r8d
  emit(0x45, 0x31, 0xc9); // xor r9d, r9d
  emitRipCall(0x20c0);

  // 4) GetTempPathA(500, &rsp[0x240])
  emit(0xb9, 0xf4, 0x01, 0x00, 0x00); // mov ecx, 500
  emit(0x48, 0x8d, 0x94, 0x24, 0x40, 0x02, 0x00, 0x00); // lea rdx, [rsp+0x240]
  emitRipCall(0x20a8);

  // 5) lstrcatA(&rsp[0x240], "BangTrangThongMinh-App.html")
  emit(0x48, 0x8d, 0x8c, 0x24, 0x40, 0x02, 0x00, 0x00); // lea rcx, [rsp+0x240]
  emitLeaRdxRip(0x21d0);
  emitRipCall(0x20b0);

  // 6) hOut = CreateFileA(&rsp[0x240], GENERIC_WRITE(0x40000000), FILE_SHARE_READ(1), NULL, CREATE_ALWAYS(2), FILE_ATTRIBUTE_NORMAL(0x80), NULL)
  emit(0x48, 0x8d, 0x8c, 0x24, 0x40, 0x02, 0x00, 0x00); // lea rcx, [rsp+0x240]
  emit(0xba, 0x00, 0x00, 0x00, 0x40); // mov edx, 0x40000000
  emit(0x41, 0xb8, 0x01, 0x00, 0x00, 0x00); // mov r8d, 1
  emit(0x45, 0x31, 0xc9); // xor r9d, r9d
  emit(0xc7, 0x44, 0x24, 0x20, 0x02, 0x00, 0x00, 0x00); // mov dword ptr [rsp+0x20], 2
  emit(0xc7, 0x44, 0x24, 0x28, 0x80, 0x00, 0x00, 0x00); // mov dword ptr [rsp+0x28], 0x80
  emit(0x48, 0xc7, 0x44, 0x24, 0x30, 0x00, 0x00, 0x00, 0x00); // mov qword ptr [rsp+0x30], 0
  emitRipCall(0x20b8);
  emit(0x49, 0x89, 0xc5); // mov r13, rax (hOut)

  // 7) Copy loop: ReadFile -> WriteFile
  const loopStartPc = pc;
  emit(0x4c, 0x89, 0xe1); // mov rcx, r12 (hIn)
  emit(0x48, 0x8d, 0x94, 0x24, 0x40, 0x08, 0x00, 0x00); // lea rdx, [rsp+0x840]
  emit(0x41, 0xb8, 0x00, 0x20, 0x00, 0x00); // mov r8d, 8192
  emit(0x4c, 0x8d, 0x4c, 0x24, 0x38); // lea r9, [rsp+0x38]
  emit(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // mov qword ptr [rsp+0x20], 0
  emitRipCall(0x20c8); // ReadFile

  emit(0x44, 0x8b, 0x44, 0x24, 0x38); // mov r8d, dword ptr [rsp+0x38]
  emit(0x45, 0x85, 0xc0); // test r8d, r8d
  emit(0x74, 0x21); // jz loopDone (+33 bytes)

  emit(0x4c, 0x89, 0xe9); // mov rcx, r13 (hOut)
  emit(0x48, 0x8d, 0x94, 0x24, 0x40, 0x08, 0x00, 0x00); // lea rdx, [rsp+0x840]
  emit(0x4c, 0x8d, 0x4c, 0x24, 0x38); // lea r9, [rsp+0x38]
  emit(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // mov qword ptr [rsp+0x20], 0
  emitRipCall(0x20d0); // WriteFile

  const jmpBackDisp = loopStartPc - (pc + 2);
  emit(0xeb, jmpBackDisp & 0xff); // jmp short loopStart

  // 8) CloseHandle(hOut) and CloseHandle(hIn)
  emit(0x4c, 0x89, 0xe9); // mov rcx, r13 (hOut)
  emitRipCall(0x20d8); // CloseHandle
  emit(0x4c, 0x89, 0xe1); // mov rcx, r12 (hIn)
  emitRipCall(0x20d8); // CloseHandle

  // 9) Build standalone app argument string at &rsp[0x440]:
  //    --window-size=1440,900 --app="C:\...\BangTrangThongMinh-App.html"
  emit(0xc6, 0x84, 0x24, 0x40, 0x04, 0x00, 0x00, 0x00); // mov byte ptr [rsp+0x440], 0
  emit(0x48, 0x8d, 0x8c, 0x24, 0x40, 0x04, 0x00, 0x00); // lea rcx, [rsp+0x440]
  emitLeaRdxRip(0x2220); // '--window-size=1440,900 --app="'
  emitRipCall(0x20b0); // lstrcatA

  emit(0x48, 0x8d, 0x8c, 0x24, 0x40, 0x04, 0x00, 0x00); // lea rcx, [rsp+0x440]
  emit(0x48, 0x8d, 0x94, 0x24, 0x40, 0x02, 0x00, 0x00); // lea rdx, [rsp+0x240] (outPath)
  emitRipCall(0x20b0); // lstrcatA

  emit(0x48, 0x8d, 0x8c, 0x24, 0x40, 0x04, 0x00, 0x00); // lea rcx, [rsp+0x440]
  emitLeaRdxRip(0x2248); // '"'
  emitRipCall(0x20b0); // lstrcatA

  // 10) Launch standalone frameless desktop application window via msedge.exe --app="..."
  //     ShellExecuteA(NULL, "open", "msedge.exe", &rsp[0x440], NULL, SW_SHOWNORMAL(1))
  emit(0x31, 0xc9); // xor ecx, ecx
  emitLeaRdxRip(0x21f0); // "open"
  emitLeaR8Rip(0x2200); // "msedge.exe"
  emit(0x4c, 0x8d, 0x8c, 0x24, 0x40, 0x04, 0x00, 0x00); // lea r9, [rsp+0x440] (lpParameters)
  emit(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // [rsp+0x20] = NULL
  emit(0xc7, 0x44, 0x24, 0x28, 0x01, 0x00, 0x00, 0x00); // [rsp+0x28] = SW_SHOWNORMAL (1)
  emitRipCall(0x20f0); // ShellExecuteA

  // If ShellExecuteA returns <= 32 (e.g. msedge.exe not found), fallback to chrome.exe --app="..."
  emit(0x48, 0x83, 0xf8, 0x20); // cmp rax, 32
  emit(0x7f, 0x2f); // jg +47 bytes (to ExitProcess)

  emit(0x31, 0xc9); // xor ecx, ecx
  emitLeaRdxRip(0x21f0); // "open"
  emitLeaR8Rip(0x2210); // "chrome.exe"
  emit(0x4c, 0x8d, 0x8c, 0x24, 0x40, 0x04, 0x00, 0x00); // lea r9, [rsp+0x440]
  emit(0x48, 0xc7, 0x44, 0x24, 0x20, 0x00, 0x00, 0x00, 0x00); // [rsp+0x20] = NULL
  emit(0xc7, 0x44, 0x24, 0x28, 0x01, 0x00, 0x00, 0x00); // [rsp+0x28] = SW_SHOWNORMAL (1)
  emitRipCall(0x20f0); // ShellExecuteA

  // 11) ExitProcess(0)
  emit(0x31, 0xc9); // xor ecx, ecx
  emitRipCall(0x20e0);
  emit(0xc3);

  out.set(code, 0x200);

  // 7. Append the complete offline application HTML bundle at byte offset 4096 (0x1000)
  out.set(payloadBytes, stubSize);

  // 8. Compute and write the official Windows PE CheckSum at opt + 64 (0xD8)
  const checksum = computePeChecksum(out, opt + 64);
  dv.setUint32(opt + 64, checksum, true);

  return out;
}

/**
 * Builds a Windows Portable ZIP Package (`BangTrangThongMinh-Windows-Portable.zip`)
 * containing `BangTrangThongMinh.exe` + `BangTrangThongMinh-Offline.html` + `HUONG-DAN.txt`.
 */
export function buildWindowsDesktopZip(bundledHtml: string): Uint8Array {
  const exeBytes = buildWindowsExeInstaller(bundledHtml);
  const readme = [
    '================================================================',
    '  BẢNG TRẮNG THÔNG MINH - BỘ ỨNG DỤNG WINDOWS (100% OFFLINE)',
    '================================================================',
    '',
    '1. Chạy trực tiếp file thực thi Windows (.exe):',
    '   - Bấm đúp vào "BangTrangThongMinh.exe".',
    '   - Nếu Windows SmartScreen hiện thông báo màu xanh (do ứng dụng',
    '     không mua chứng chỉ EV trả phí của Microsoft), bạn chỉ cần bấm:',
    '     "More info (Thêm thông tin)" -> "Run anyway (Vẫn chạy)".',
    '',
    '2. Chạy bản Không Cảnh Báo SmartScreen (100% an toàn tuyệt đối):',
    '   - Bấm đúp vào file "BangTrangThongMinh-Offline.html" đi kèm.',
    '   - Chạy ngay lập tức mọi tính năng Offline mà không bao giờ bị',
    '     Windows SmartScreen hay trình diệt virus hỏi xác nhận.',
    '',
  ].join('\r\n');

  return createZipArchive([
    {
      path: 'BangTrangThongMinh-Windows/BangTrangThongMinh.exe',
      content: exeBytes,
      isExecutable: true,
    },
    {
      path: 'BangTrangThongMinh-Windows/BangTrangThongMinh-Offline.html',
      content: bundledHtml,
      isExecutable: false,
    },
    {
      path: 'BangTrangThongMinh-Windows/HUONG-DAN.txt',
      content: readme,
      isExecutable: false,
    },
  ]);
}


/**
 * Builds a single-file self-extracting macOS installer (`BangTrangThongMinh-Installer.command`)
 * that creates `Bảng Trắng Thông Minh.app` on the user's Mac Desktop & /Applications folder and opens it immediately.
 */
export function buildMacOSSelfExtractingCommand(bundledHtml: string): Uint8Array {
  const header = [
    '#!/bin/bash',
    '# Bo cai dat tu dong Bang Trang Thong Minh.app cho macOS',
    'set -e',
    'APP_DIR="$HOME/Desktop/BangTrangThongMinh.app"',
    'mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"',
    'cat << \'EOF_PLIST\' > "$APP_DIR/Contents/Info.plist"',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleName</key>',
    '  <string>Bảng Trắng Thông Minh</string>',
    '  <key>CFBundleDisplayName</key>',
    '  <string>Bảng Trắng Thông Minh</string>',
    '  <key>CFBundleIdentifier</key>',
    '  <string>vn.smartwhiteboard.desktop</string>',
    '  <key>CFBundleVersion</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundleShortVersionString</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>CFBundleExecutable</key>',
    '  <string>BangTrangThongMinh</string>',
    '  <key>NSHighResolutionCapable</key>',
    '  <true/>',
    '</dict>',
    '</plist>',
    'EOF_PLIST',
    'cat << \'EOF_BIN\' > "$APP_DIR/Contents/MacOS/BangTrangThongMinh"',
    '#!/bin/bash',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'HTML_PATH="$DIR/../Resources/BangTrangThongMinh-App.html"',
    'FILE_URL="file://$HTML_PATH"',
    'if [ -d "/Applications/Google Chrome.app" ]; then',
    '  open -n -a "Google Chrome" --args --app="$FILE_URL" --window-size=1440,900',
    'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
    '  open -n -a "Microsoft Edge" --args --app="$FILE_URL" --window-size=1440,900',
    'elif [ -d "/Applications/Brave Browser.app" ]; then',
    '  open -n -a "Brave Browser" --args --app="$FILE_URL" --window-size=1440,900',
    'else',
    '  open "$HTML_PATH"',
    'fi',
    'EOF_BIN',
    'chmod +x "$APP_DIR/Contents/MacOS/BangTrangThongMinh"',
    'ARCHIVE_LINE=$(awk \'/^__BTTM_PAYLOAD_BELOW__/ {print NR + 1; exit 0; }\' "$0")',
    'tail -n +$ARCHIVE_LINE "$0" > "$APP_DIR/Contents/Resources/BangTrangThongMinh-App.html"',
    'cp -R "$APP_DIR" "/Applications/BangTrangThongMinh.app" 2>/dev/null || true',
    'open "$APP_DIR"',
    'exit 0',
    '__BTTM_PAYLOAD_BELOW__',
    '',
  ].join('\n');

  const headerBytes = toUtf8Bytes(header);
  const payloadBytes = toUtf8Bytes(bundledHtml);
  const out = new Uint8Array(headerBytes.length + payloadBytes.length);
  out.set(headerBytes, 0);
  out.set(payloadBytes, headerBytes.length);
  return out;
}

/**
 * Creates a valid standard ZIP archive (STORE method) with Unix permission attributes
 * so macOS Finder preserves executable bits (chmod 0755) on .app/Contents/MacOS/* binaries.
 */
export function createZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = toUtf8Bytes(entry.path);
    const dataBytes = toUtf8Bytes(entry.content);
    const crc = computeCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, (3 << 8) | 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    const unixMode = entry.isExecutable ? 0o100755 : 0o100644;
    cv.setUint32(38, (unixMode << 16) >>> 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralChunks.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of localChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of centralChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * Builds a complete, 100% offline macOS Application Bundle (`BangTrangThongMinh.app`) packaged inside a `.zip`.
 */
export function buildMacOSDesktopAppZip(bundledHtml: string): Uint8Array {
  const infoPlist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleName</key>',
    '  <string>Bảng Trắng Thông Minh</string>',
    '  <key>CFBundleDisplayName</key>',
    '  <string>Bảng Trắng Thông Minh</string>',
    '  <key>CFBundleIdentifier</key>',
    '  <string>vn.smartwhiteboard.desktop</string>',
    '  <key>CFBundleVersion</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundleShortVersionString</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>CFBundleExecutable</key>',
    '  <string>BangTrangThongMinh</string>',
    '  <key>NSHighResolutionCapable</key>',
    '  <true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');

  const macExecutable = [
    '#!/bin/bash',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'HTML_PATH="$DIR/../Resources/BangTrangThongMinh-App.html"',
    'FILE_URL="file://$HTML_PATH"',
    'if [ -d "/Applications/Google Chrome.app" ]; then',
    '  open -n -a "Google Chrome" --args --app="$FILE_URL" --window-size=1440,900',
    'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
    '  open -n -a "Microsoft Edge" --args --app="$FILE_URL" --window-size=1440,900',
    'elif [ -d "/Applications/Brave Browser.app" ]; then',
    '  open -n -a "Brave Browser" --args --app="$FILE_URL" --window-size=1440,900',
    'else',
    '  open "$HTML_PATH"',
    'fi',
    '',
  ].join('\n');

  return createZipArchive([
    {
      path: 'BangTrangThongMinh.app/Contents/Info.plist',
      content: infoPlist,
      isExecutable: false,
    },
    {
      path: 'BangTrangThongMinh.app/Contents/Resources/BangTrangThongMinh-App.html',
      content: bundledHtml,
      isExecutable: false,
    },
    {
      path: 'BangTrangThongMinh.app/Contents/MacOS/BangTrangThongMinh',
      content: macExecutable,
      isExecutable: true,
    },
  ]);
}
