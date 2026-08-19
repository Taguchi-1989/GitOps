import { describe, expect, it } from 'vitest';
import {
  availableExtensionTools,
  defaultExtensionToolState,
  EXTENSION_TOOLS,
  EXTENSION_TOOL_KEYS,
  isExtensionToolVisible,
  parseExtensionToolState,
} from './extension-tools';

describe('defaultExtensionToolState', () => {
  it('starts with every tool off', () => {
    const state = defaultExtensionToolState();
    for (const key of EXTENSION_TOOL_KEYS) {
      expect(state[key]).toBe(false);
    }
  });
});

describe('parseExtensionToolState', () => {
  it('returns the default state for missing or broken values', () => {
    expect(parseExtensionToolState(null)).toEqual(defaultExtensionToolState());
    expect(parseExtensionToolState('')).toEqual(defaultExtensionToolState());
    expect(parseExtensionToolState('not json')).toEqual(defaultExtensionToolState());
    expect(parseExtensionToolState('null')).toEqual(defaultExtensionToolState());
    expect(parseExtensionToolState('[1,2]')).toEqual(defaultExtensionToolState());
  });

  it('restores stored booleans and ignores anything else', () => {
    const state = parseExtensionToolState(
      JSON.stringify({ dexpi: true, bpmn: 'yes', unknown: true })
    );
    expect(state.dexpi).toBe(true);
    // 文字列は真偽値ではないので既定(OFF)に倒す
    expect(state.bpmn).toBe(false);
    expect(state.audit).toBe(false);
    expect(Object.keys(state).sort()).toEqual([...EXTENSION_TOOL_KEYS].sort());
  });
});

describe('isExtensionToolVisible', () => {
  it('hides tools that are switched off, whatever the role', () => {
    const state = defaultExtensionToolState();
    expect(isExtensionToolVisible('dexpi', state, 'admin')).toBe(false);
    expect(isExtensionToolVisible('audit', state, 'admin')).toBe(false);
  });

  it('shows a switched-on general tool to every role', () => {
    const state = { ...defaultExtensionToolState(), dexpi: true };
    expect(isExtensionToolVisible('dexpi', state, 'admin')).toBe(true);
    expect(isExtensionToolVisible('dexpi', state, 'editor')).toBe(true);
    expect(isExtensionToolVisible('dexpi', state, 'viewer')).toBe(true);
  });

  it('keeps admin-only tools hidden from non-admins even when switched on', () => {
    const state = { ...defaultExtensionToolState(), audit: true, aims: true };
    expect(isExtensionToolVisible('audit', state, 'admin')).toBe(true);
    expect(isExtensionToolVisible('audit', state, 'editor')).toBe(false);
    expect(isExtensionToolVisible('aims', state, 'viewer')).toBe(false);
  });
});

describe('availableExtensionTools', () => {
  it('offers every tool to an admin', () => {
    expect(availableExtensionTools('admin').sort()).toEqual([...EXTENSION_TOOL_KEYS].sort());
  });

  it('hides admin-only tools from the settings screen for other roles', () => {
    const forEditor = availableExtensionTools('editor');
    expect(forEditor).not.toContain('audit');
    expect(forEditor).not.toContain('aims');
    expect(forEditor).toContain('dexpi');
    expect(availableExtensionTools('viewer')).toEqual(forEditor);
  });
});

describe('EXTENSION_TOOLS', () => {
  it('describes every tool in plain Japanese', () => {
    for (const key of EXTENSION_TOOL_KEYS) {
      expect(EXTENSION_TOOLS[key].label).toBeTruthy();
      expect(EXTENSION_TOOLS[key].description).toBeTruthy();
    }
  });
});
