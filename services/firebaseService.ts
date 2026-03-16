import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
    writeBatch,
    setDoc,
    onSnapshot
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import { db, storage, auth } from '../config/firebase';
import { VisualTrade, CustodyOverride, GeneralReminder, AnnualReminder } from '../types';

/**
 * Upload an image from base64 to Firebase Storage
 * @param base64 - Base64 string of the image
 * @param mimeType - Mime type of the image
 * @param tradeId - Trade ID to associate with the image
 * @returns Download URL of the uploaded image
 */
export const uploadTradeImageFromBase64 = async (base64: string, mimeType: string, tradeId: string): Promise<string> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        const timestamp = Date.now();
        const fileName = `users/${user.uid}/trades/${tradeId}/${timestamp}_image`;
        const storageRef = ref(storage, fileName);

        // Convert base64 to Blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading base64 image:', error);
        throw new Error('Failed to upload image from base64');
    }
};

/**
 * Upload an image to Firebase Storage
 * @param file - Image file to upload
 * @param tradeId - Trade ID to associate with the image
 * @returns Download URL of the uploaded image
 */
export const uploadTradeImage = async (file: File, tradeId: string): Promise<string> => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        const timestamp = Date.now();
        // Ruta corregida: users/{userId}/trades/{tradeId}/{fileName}
        const fileName = `users/${user.uid}/trades/${tradeId}/${timestamp}_${file.name}`;
        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image');
    }
};

/**
 * Delete an image from Firebase Storage
 * @param imageUrl - URL of the image to delete
 */
export const deleteTradeImage = async (imageUrl: string): Promise<void> => {
    try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error) {
        console.error('Error deleting image:', error);
        // Don't throw error if image doesn't exist
    }
};

/**
 * Save a trade to Firestore
 * @param trade - Trade data to save
 * @param userId - ID of the user owning the trade
 * @returns The saved trade with Firestore ID
 */
export const saveTrade = async (trade: Omit<VisualTrade, 'id'>, userId: string): Promise<VisualTrade> => {
    try {
        const tradeData = {
            ...trade,
            createdAt: Timestamp.fromMillis(trade.createdAt),
        };

        const docRef = await addDoc(collection(db, `users/${userId}/trades`), tradeData);

        return {
            ...trade,
            id: docRef.id,
        };
    } catch (error) {
        console.error('Error saving trade:', error);
        throw new Error('Failed to save trade');
    }
};

/**
 * Get all trades from Firestore for a specific user
 * @param userId - ID of the user
 * @returns Array of trades ordered by creation date (newest first)
 */
export const getAllTrades = async (userId: string): Promise<VisualTrade[]> => {
    try {
        const q = query(
            collection(db, `users/${userId}/trades`),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);

        const trades: VisualTrade[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: data.createdAt.toMillis(),
            } as VisualTrade;
        });

        return trades;
    } catch (error) {
        console.error('Error getting trades:', error);
        throw new Error('Failed to get trades');
    }
};

/**
 * Update a trade in Firestore
 * @param tradeId - ID of the trade to update
 * @param updates - Partial trade data to update
 * @param userId - ID of the user
 */
export const updateTrade = async (
    tradeId: string,
    updates: Partial<Omit<VisualTrade, 'id' | 'createdAt'>>,
    userId: string
): Promise<void> => {
    try {
        const tradeRef = doc(db, `users/${userId}/trades`, tradeId);
        await updateDoc(tradeRef, updates);
    } catch (error) {
        console.error('Error updating trade:', error);
        throw new Error('Failed to update trade');
    }
};

/**
 * Delete a trade from Firestore
 * @param tradeId - ID of the trade to delete
 * @param userId - ID of the user
 */
export const deleteTrade = async (tradeId: string, userId: string): Promise<void> => {
    try {
        const tradeRef = doc(db, `users/${userId}/trades`, tradeId);
        await deleteDoc(tradeRef);
    } catch (error) {
        console.error('Error deleting trade:', error);
        throw new Error('Failed to delete trade');
    }
};

/**
 * Migrate trades from localStorage to Firestore
 * @param localTrades - Array of trades from localStorage
 * @param userId - ID of the user
 */
export const migrateLocalTradesToFirebase = async (localTrades: VisualTrade[], userId: string): Promise<void> => {
    try {
        const promises = localTrades.map(trade => {
            const { id, ...tradeData } = trade;
            return saveTrade(tradeData, userId);
        });

        await Promise.all(promises);
        console.log(`Successfully migrated ${localTrades.length} trades to Firebase`);
    } catch (error) {
        console.error('Error migrating trades:', error);
        throw new Error('Failed to migrate trades');
    }
};

/**
 * Migrate trades from the old global 'trades' collection to the user's collection
 * @param userId - ID of the user
 * @returns Number of trades migrated
 */
export const migrateLegacyGlobalTrades = async (userId: string): Promise<number> => {
    try {
        // Query the old root collection
        // Note: This requires temporary read access to 'trades' in Firestore Rules
        const q = query(collection(db, 'trades'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return 0;
        }

        let count = 0;
        const promises = querySnapshot.docs.map(async (docSnapshot) => {
            const data = docSnapshot.data();

            // Check if this trade already exists in user's collection to avoid duplicates
            // (Simple check by ID if we preserved it, but here we are generating new IDs usually. 
            // We'll just add it for now, assuming migration is run once)

            // We use the same data, but ensure it's saved under the user
            // We use the same data, but ensure it's saved under the user with the same ID
            await setDoc(doc(db, `users/${userId}/trades`, docSnapshot.id), data);
            count++;
        });

        await Promise.all(promises);
        return count;
    } catch (error) {
        console.error('Error migrating legacy global trades:', error);
        throw new Error('Failed to migrate legacy trades. Check permissions.');
    }
};

/**
 * Migrate budget data from legacy root collections to user-scoped collections
 * @param userId - ID of the user
 * @returns Object with count of migrated documents for each collection
 */
export const migrateLegacyBudgetData = async (userId: string): Promise<{
    accounts: number;
    transactions: number;
    categories: number;
    budgets: number;
    recurringDebts: number;
}> => {
    try {
        const result = {
            accounts: 0,
            transactions: 0,
            categories: 0,
            budgets: 0,
            recurringDebts: 0,
        };

        // Helper function to migrate a collection
        const migrateCollection = async (collectionName: string): Promise<number> => {
            const legacyRef = collection(db, collectionName);
            const userRef = collection(db, `users/${userId}/${collectionName}`);

            const snapshot = await getDocs(legacyRef);

            if (snapshot.empty) {
                console.log(`No legacy ${collectionName} to migrate`);
                return 0;
            }

            let count = 0;
            const batch = writeBatch(db);

            snapshot.docs.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                const newDocRef = doc(userRef, docSnapshot.id);
                batch.set(newDocRef, data);
                count++;
            });

            await batch.commit();
            console.log(`Migrated ${count} ${collectionName}`);
            return count;
        };

        // Migrate each collection
        result.accounts = await migrateCollection('accounts');
        result.transactions = await migrateCollection('transactions');
        result.categories = await migrateCollection('categories');
        result.budgets = await migrateCollection('budgets');
        result.recurringDebts = await migrateCollection('recurringDebts');

        return result;
    } catch (error) {
        console.error('Error migrating legacy budget data:', error);
        throw new Error('Failed to migrate legacy budget data. Check permissions.');
    }
};

/**
 * Run full migration of all legacy data to user-scoped collections
 * @param userId - ID of the user
 * @returns Summary of migration results
 */
export const runFullMigration = async (userId: string): Promise<{
    trades: number;
    accounts: number;
    transactions: number;
    categories: number;
    budgets: number;
    recurringDebts: number;
    total: number;
}> => {
    try {
        console.log('[Migration] Starting full data migration for user:', userId);

        // Migrate trades
        const tradesCount = await migrateLegacyGlobalTrades(userId);

        // Migrate budget data
        const budgetData = await migrateLegacyBudgetData(userId);

        const total = tradesCount + budgetData.accounts + budgetData.transactions +
            budgetData.categories + budgetData.budgets + budgetData.recurringDebts;

        const result = {
            trades: tradesCount,
            ...budgetData,
            total,
        };

        // Mark migration as completed in Firestore
        await setMigrationCompleted(userId);

        console.log('[Migration] Completed successfully:', result);
        return result;
    } catch (error) {
        console.error('[Migration] Error during full migration:', error);
        throw error;
    }
};

/**
 * Check if user has any legacy data that needs migration
 * @param userId - ID of the user
 * @returns true if legacy data exists and migration hasn't been recorded yet
 */
export const hasLegacyData = async (userId: string): Promise<boolean> => {
    try {
        // First check if migration was already performed for this user
        const statusSnap = await getDocs(query(collection(db, `users/${userId}/migration_status`)));

        if (!statusSnap.empty) {
            console.log('[Migration] Migration already completed previously for this user');
            return false;
        }

        const collections = ['trades', 'accounts', 'transactions', 'categories', 'budgets', 'recurringDebts'];

        for (const collectionName of collections) {
            const snapshot = await getDocs(collection(db, collectionName));
            if (!snapshot.empty) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking for legacy data:', error);
        return false;
    }
};

/**
 * Mark migration as completed for a user
 * @param userId - ID of the user
 */
export const setMigrationCompleted = async (userId: string): Promise<void> => {
    try {
        const statusRef = doc(db, `users/${userId}/migration_status`, 'status');
        await setDoc(statusRef, {
            completed: true,
            completedAt: Date.now(),
        });
    } catch (error) {
        console.error('Error marking migration as completed:', error);
    }
};


/**
 * Reset all user data by deleting all documents in user's subcollections
 * @param userId - ID of the user
 */
export const resetUserData = async (userId: string): Promise<void> => {
    try {
        const collectionsToDelete = [
            'trades',
            'accounts',
            'transactions',
            'categories',
            'budgets',
            'recurringDebts',
            'custody_overrides'
        ];

        for (const colName of collectionsToDelete) {
            const colRef = collection(db, `users/${userId}/${colName}`);
            const snapshot = await getDocs(colRef);

            if (snapshot.empty) continue;

            // Delete in batches of 500 (Firestore limit)
            const batches = [];
            let batch = writeBatch(db);
            let operationCount = 0;

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                operationCount++;

                if (operationCount === 500) {
                    batches.push(batch.commit());
                    batch = writeBatch(db);
                    operationCount = 0;
                }
            });

            if (operationCount > 0) {
                batches.push(batch.commit());
            }

            await Promise.all(batches);
            console.log(`Deleted collection: ${colName}`);
        }
    } catch (error) {
        console.error('Error resetting user data:', error);
        throw new Error('Failed to reset user data');
    }
};

/**
 * Save a custody override to Firestore (Shared collection)
 * @param override - Override data
 */
export const saveCustodyOverride = async (override: Omit<CustodyOverride, 'id' | 'createdAt'>): Promise<CustodyOverride> => {
    try {
        const overrideData = {
            ...override,
            createdAt: Date.now(),
        };

        // Use date as ID to ensure one override per day
        const docRef = doc(db, 'custody_overrides', override.date);
        await setDoc(docRef, overrideData);

        return {
            ...overrideData,
            id: override.date,
        };
    } catch (error) {
        console.error('Error saving custody override:', error);
        throw new Error('Failed to save custody override');
    }
};

/**
 * Get all custody overrides (Shared collection)
 */
export const getCustodyOverrides = async (): Promise<CustodyOverride[]> => {
    try {
        const q = query(collection(db, 'custody_overrides'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
        } as CustodyOverride));
    } catch (error) {
        console.error('Error getting custody overrides:', error);
        throw new Error('Failed to get custody overrides');
    }
};

/**
 * Subscribe to custody overrides in real-time
 * @param callback - Function to call with updated overrides
 */
export const subscribeToCustodyOverrides = (callback: (overrides: CustodyOverride[]) => void) => {
    const q = query(collection(db, 'custody_overrides'));
    return onSnapshot(q, (snapshot) => {
        const overrides = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as CustodyOverride));
        callback(overrides);
    }, (error) => {
        console.error('Error subscribing to custody overrides:', error);
        alert('Error en suscripción de custodia: ' + error.message);
    });
};

/**
 * Delete a custody override (Shared collection)
 * @param date - Date of the override (YYYY-MM-DD)
 */
export const deleteCustodyOverride = async (date: string): Promise<void> => {
    try {
        const docRef = doc(db, 'custody_overrides', date);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting custody override:', error);
        throw new Error('Failed to delete custody override');
    }
};

/**
 * Save a general reminder to Firestore
 */
export const saveGeneralReminder = async (text: string): Promise<GeneralReminder> => {
    try {
        const reminderData = {
            text,
            createdAt: Date.now(),
        };

        const docRef = await addDoc(collection(db, 'general_reminders'), reminderData);

        return {
            ...reminderData,
            id: docRef.id,
        };
    } catch (error) {
        console.error('Error saving general reminder:', error);
        throw error;
    }
};

/**
 * Subscribe to general reminders in real-time
 */
export const subscribeToGeneralReminders = (callback: (reminders: GeneralReminder[]) => void) => {
    // No orderBy to avoid index issues
    const q = query(collection(db, 'general_reminders'));
    return onSnapshot(q, (snapshot) => {
        const reminders = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as GeneralReminder));
        callback(reminders);
    }, (error) => {
        console.error('Error subscribing to general reminders:', error);
        alert('Error en suscripción de recordatorios generales: ' + error.message);
    });
};

/**
 * Delete a general reminder
 */
export const deleteGeneralReminder = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, 'general_reminders', id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting general reminder:', error);
        throw new Error('Failed to delete general reminder');
    }
};

/**
 * Save an annual reminder to Firestore
 */
export const saveAnnualReminder = async (reminder: Omit<AnnualReminder, 'id' | 'createdAt'>): Promise<AnnualReminder> => {
    try {
        const reminderData = {
            ...reminder,
            createdAt: Date.now(),
        };

        const docRef = await addDoc(collection(db, 'annual_reminders'), reminderData);

        return {
            ...reminderData,
            id: docRef.id,
        };
    } catch (error) {
        console.error('Error saving annual reminder:', error);
        throw error;
    }
};

/**
 * Subscribe to annual reminders in real-time
 */
export const subscribeToAnnualReminders = (callback: (reminders: AnnualReminder[]) => void) => {
    // No orderBy to avoid index issues
    const q = query(collection(db, 'annual_reminders'));
    return onSnapshot(q, (snapshot) => {
        const reminders = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as AnnualReminder));
        callback(reminders);
    }, (error) => {
        console.error('Error subscribing to annual reminders:', error);
        alert('Error en suscripción de recordatorios fijos: ' + error.message);
    });
};

/**
 * Delete an annual reminder
 */
export const deleteAnnualReminder = async (id: string): Promise<void> => {
    try {
        const docRef = doc(db, 'annual_reminders', id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting annual reminder:', error);
        throw new Error('Failed to delete annual reminder');
    }
};
