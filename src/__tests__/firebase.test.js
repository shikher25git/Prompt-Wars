import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGoogle, signOutUser, saveMedicalProfile } from '../firebase.js';

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'test-user-id' } })),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn().mockResolvedValue({ user: { uid: 'test-user-id' } }),
  signOut: vi.fn().mockResolvedValue(),
  onAuthStateChanged: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(() => 'mockCollection'),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    empty: false,
    forEach: vi.fn((cb) => cb({ id: 'doc1', data: () => ({ name: 'Test' }) }))
  })
}));

describe('Firebase Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in with Google successfully', async () => {
    const user = await signInWithGoogle();
    expect(user).toBeDefined();
    expect(user.uid).toBe('test-user-id');
  });

  it('signs out successfully', async () => {
    await signOutUser();
    // Resolving without error implies success in the mock
    expect(true).toBe(true);
  });

  it('saves medical profile without throwing', async () => {
    const mockData = { patient: { name: 'Shikher' } };
    const docRef = await saveMedicalProfile('test-uid', mockData);
    expect(docRef).toBeDefined();
  });
});
