import { describe, it, expect } from 'vitest';
import { optimizeImage } from '../utils.js';

describe('Image Optimization Utility', () => {
  it('should ignore non-image files', async () => {
    const textFile = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const result = await optimizeImage(textFile);
    expect(result).toBe(textFile);
  });

  // Note: Canvas and FileReader are typically mocked in JSDOM, 
  // so a full end-to-end canvas test requires setupFile mocks or vitest-canvas-mock.
  // We're testing the bypass logic here for the hackathon baseline coverage.
});
