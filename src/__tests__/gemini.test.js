import { describe, it, expect, vi } from 'vitest';
import { initGemini, isInitialized } from '../gemini.js';

describe('Gemini Client', () => {
  it('should start uninitialized', () => {
    expect(isInitialized()).toBe(false);
  });

  it('should initialize with an API key', () => {
    // We mock the GoogleGenerativeAI to avoid network calls during init
    initGemini('fake-api-key');
    expect(isInitialized()).toBe(true);
  });
});
