import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMacArchSignals } from './macArch';

describe('macArch — macOS CPU architecture classification (Apple Silicon vs Intel)', () => {
  it('detects Apple Silicon via Chromium User-Agent Client Hints', () => {
    assert.deepEqual(classifyMacArchSignals({ uaDataArchitecture: 'arm' }), {
      arch: 'arm64',
      detected: true,
      source: 'ua-data',
    });
  });

  it('detects Intel via Chromium User-Agent Client Hints', () => {
    assert.deepEqual(classifyMacArchSignals({ uaDataArchitecture: 'x86' }), {
      arch: 'x64',
      detected: true,
      source: 'ua-data',
    });
  });

  it('detects Intel Mac via WebGL Intel/AMD renderer strings (Firefox / older Safari)', () => {
    assert.deepEqual(
      classifyMacArchSignals({
        webglRenderer: 'ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 645, OpenGL 4.1)',
        webglVendor: 'Google Inc. (Intel Inc.)',
      }),
      {
        arch: 'x64',
        detected: true,
        source: 'webgl-renderer',
      }
    );

    assert.deepEqual(
      classifyMacArchSignals({
        webglRenderer: 'AMD Radeon Pro 5500M OpenGL Engine',
        webglVendor: 'ATI Technologies Inc.',
      }),
      {
        arch: 'x64',
        detected: true,
        source: 'webgl-renderer',
      }
    );
  });

  it('detects Apple Silicon via explicit Apple M-series WebGL renderer string', () => {
    assert.deepEqual(
      classifyMacArchSignals({
        webglRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
        webglVendor: 'Google Inc. (Apple)',
      }),
      {
        arch: 'arm64',
        detected: true,
        source: 'webgl-renderer',
      }
    );
  });

  it('distinguishes Safari masked "Apple GPU" on Apple Silicon vs Intel via texture extensions', () => {
    // Safari on Apple Silicon: "Apple GPU" + ASTC/ETC support
    assert.deepEqual(
      classifyMacArchSignals({
        webglRenderer: 'Apple GPU',
        webglVendor: 'Apple Inc.',
        webglExtensions: ['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_s3tc'],
      }),
      {
        arch: 'arm64',
        detected: true,
        source: 'webgl-extensions',
      }
    );

    // Safari on Intel Mac: "Apple GPU" + S3TC only (no ASTC/ETC)
    assert.deepEqual(
      classifyMacArchSignals({
        webglRenderer: 'Apple GPU',
        webglVendor: 'Apple Inc.',
        webglExtensions: ['WEBGL_compressed_texture_s3tc', 'OES_texture_float'],
      }),
      {
        arch: 'x64',
        detected: true,
        source: 'webgl-extensions',
      }
    );
  });

  it('falls back safely to arm64 with detected=false when no conclusive signal exists', () => {
    assert.deepEqual(classifyMacArchSignals({}), {
      arch: 'arm64',
      detected: false,
      source: 'fallback',
    });
  });
});
