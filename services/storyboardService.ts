import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage, auth } from '../config/firebase';
import { StoryboardItem } from '../types';

const DB_NAME = 'rodez_storyboard_db';
const STORE_NAME = 'items';
const DB_VERSION = 1;

/**
 * Open or initialize the IndexedDB database
 */
const openLocalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all items from local IndexedDB
 */
export const getLocalStoryboardItems = async (): Promise<StoryboardItem[]> => {
  try {
    const idb = await openLocalDB();
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const items: StoryboardItem[] = request.result || [];
        // Sort: Pinned first, then newest first
        items.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.createdAt - a.createdAt;
        });
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[Storyboard] IndexedDB fallback to localStorage', err);
    try {
      const raw = localStorage.getItem('rodez_storyboard_backup');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
};

/**
 * Save an item to local IndexedDB
 */
export const saveLocalStoryboardItem = async (item: StoryboardItem): Promise<void> => {
  try {
    const idb = await openLocalDB();
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[Storyboard] Failed to save in IndexedDB', err);
  }
};

/**
 * Delete an item from local IndexedDB
 */
export const deleteLocalStoryboardItem = async (id: string): Promise<void> => {
  try {
    const idb = await openLocalDB();
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[Storyboard] Failed to delete in IndexedDB', err);
  }
};

/**
 * Upload a storyboard image to Firebase Storage
 */
export const uploadStoryboardImage = async (
  imageData: string,
  itemId: string,
  userId: string
): Promise<string> => {
  try {
    const cleanBase64 = imageData.includes('base64,')
      ? imageData.split('base64,')[1]
      : imageData;

    const mimeMatch = imageData.match(/^data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const storagePath = `users/${userId}/storyboard/${itemId}_${Date.now()}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error('[Storyboard] Error uploading image to Firebase Storage:', err);
    // If upload fails, return the original data URI as fallback
    return imageData;
  }
};

/**
 * Fetch all storyboard items (IndexedDB + Firebase Sync)
 */
export const getStoryboardItems = async (userId?: string): Promise<StoryboardItem[]> => {
  // 1. First get local items for instant render
  const localItems = await getLocalStoryboardItems();

  if (!userId && !auth.currentUser?.uid) {
    return localItems;
  }

  const uid = userId || auth.currentUser?.uid;
  if (!uid) return localItems;

  try {
    const colRef = collection(db, 'users', uid, 'storyboard');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const remoteItems: StoryboardItem[] = [];
      snapshot.forEach((docSnap) => {
        remoteItems.push(docSnap.data() as StoryboardItem);
      });

      // Update local storage cache with remote items
      for (const item of remoteItems) {
        await saveLocalStoryboardItem(item);
      }

      remoteItems.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
      });

      return remoteItems;
    } else if (localItems.length > 0) {
      // Migrate local items to Firestore if remote is empty
      console.log('[Storyboard] Syncing local items to Firestore for user:', uid);
      for (const item of localItems) {
        try {
          const docRef = doc(db, 'users', uid, 'storyboard', item.id);
          await setDoc(docRef, item);
        } catch (e) {
          console.warn('[Storyboard] Error migrating item to Firestore:', e);
        }
      }
    }
  } catch (err) {
    console.warn('[Storyboard] Could not fetch from Firestore, returning local data:', err);
  }

  return localItems;
};

/**
 * Save a new Storyboard Item
 */
export const saveStoryboardItem = async (
  itemData: Omit<StoryboardItem, 'id' | 'createdAt'>,
  userId?: string
): Promise<StoryboardItem> => {
  const id = crypto.randomUUID();
  const uid = userId || auth.currentUser?.uid;
  let finalImageUrl = itemData.imageUrl;

  // If we have an authenticated user and the image is base64, upload to Firebase Storage
  if (uid && itemData.imageUrl.startsWith('data:')) {
    try {
      finalImageUrl = await uploadStoryboardImage(itemData.imageUrl, id, uid);
    } catch (err) {
      console.warn('[Storyboard] Image upload failed, storing locally:', err);
    }
  }

  const newItem: StoryboardItem = {
    ...itemData,
    id,
    imageUrl: finalImageUrl,
    imageBase64: itemData.imageUrl.startsWith('data:') ? itemData.imageUrl : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Save in local IndexedDB
  await saveLocalStoryboardItem(newItem);

  // 2. Save in Firestore if authenticated
  if (uid) {
    try {
      const docRef = doc(db, 'users', uid, 'storyboard', id);
      // Remove large raw base64 before saving to Firestore doc to stay within 1MB doc limit
      const firestoreData = { ...newItem };
      if (firestoreData.imageUrl.startsWith('http')) {
        delete firestoreData.imageBase64;
      }
      await setDoc(docRef, firestoreData);
    } catch (err) {
      console.warn('[Storyboard] Could not save to Firestore:', err);
    }
  }

  return newItem;
};

/**
 * Update an existing Storyboard Item
 */
export const updateStoryboardItem = async (
  item: StoryboardItem,
  userId?: string
): Promise<void> => {
  const uid = userId || auth.currentUser?.uid;
  const updatedItem: StoryboardItem = {
    ...item,
    updatedAt: Date.now()
  };

  // Save in local IndexedDB
  await saveLocalStoryboardItem(updatedItem);

  // Update in Firestore
  if (uid) {
    try {
      const docRef = doc(db, 'users', uid, 'storyboard', item.id);
      const firestoreData = { ...updatedItem };
      if (firestoreData.imageUrl.startsWith('http')) {
        delete firestoreData.imageBase64;
      }
      await updateDoc(docRef, firestoreData);
    } catch (err) {
      console.warn('[Storyboard] Could not update in Firestore:', err);
    }
  }
};

/**
 * Delete a Storyboard Item
 */
export const deleteStoryboardItem = async (
  id: string,
  imageUrl?: string,
  userId?: string
): Promise<void> => {
  const uid = userId || auth.currentUser?.uid;

  // 1. Remove from local IndexedDB
  await deleteLocalStoryboardItem(id);

  // 2. Remove from Firestore
  if (uid) {
    try {
      const docRef = doc(db, 'users', uid, 'storyboard', id);
      await deleteDoc(docRef);

      // Try deleting from Storage if it was hosted there
      if (imageUrl && imageUrl.includes('firebasestorage')) {
        try {
          const storageRef = ref(storage, imageUrl);
          await deleteObject(storageRef);
        } catch {
          // Ignore storage delete errors
        }
      }
    } catch (err) {
      console.warn('[Storyboard] Could not delete from Firestore:', err);
    }
  }
};

/**
 * Toggle pinned status for quick focus during trading session
 */
export const togglePinStoryboardItem = async (
  item: StoryboardItem,
  userId?: string
): Promise<StoryboardItem> => {
  const updated: StoryboardItem = {
    ...item,
    isPinned: !item.isPinned,
    updatedAt: Date.now()
  };
  await updateStoryboardItem(updated, userId);
  return updated;
};

/**
 * Export all storyboard items to a JSON string for offline backup
 */
export const exportStoryboardBackup = async (): Promise<string> => {
  const items = await getLocalStoryboardItems();
  return JSON.stringify({
    version: '1.0',
    exportDate: new Date().toISOString(),
    items
  }, null, 2);
};

/**
 * Import storyboard items from JSON backup
 */
export const importStoryboardBackup = async (
  jsonData: string,
  userId?: string
): Promise<number> => {
  try {
    const parsed = JSON.parse(jsonData);
    const items: StoryboardItem[] = Array.isArray(parsed) ? parsed : parsed.items || [];
    let count = 0;

    for (const item of items) {
      if (item.title && (item.imageUrl || item.imageBase64)) {
        await saveLocalStoryboardItem(item);
        if (userId) {
          try {
            const docRef = doc(db, 'users', userId, 'storyboard', item.id);
            await setDoc(docRef, item);
          } catch {
            // Ignore single doc sync errors
          }
        }
        count++;
      }
    }

    return count;
  } catch (err) {
    console.error('[Storyboard] Import failed:', err);
    throw new Error('Formato de archivo inválido');
  }
};
