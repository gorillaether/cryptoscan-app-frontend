// Firebase configuration and services

import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Rate Limiting Service
export const rateLimitService = {
  // Generate a unique user ID based on browser fingerprint
  generateUserId() {
    // Use a combination of browser features to create a semi-unique ID
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
    const canvasData = canvas.toDataURL();
    const fingerprint = btoa(
      navigator.userAgent +
      navigator.language +
      navigator.platform +
      screen.width + 'x' + screen.height +
      new Date().getTimezoneOffset() +
      canvasData.slice(-50)
    ).slice(0, 20);
    return `user_${fingerprint}`;
  },

  // Check if user has exceeded daily limit and update usage
  async checkDailyLimit(maxUsesPerDay = 10) {
    try {
      const userId = this.generateUserId();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const docId = `${userId}_${today}`;
      const userUsageRef = doc(db, 'dailyUsage', docId);

      // Calculate reset time (always needed)
      const resetTime = new Date();
      resetTime.setDate(resetTime.getDate() + 1);
      resetTime.setHours(0, 0, 0, 0);

      // Get current usage for today
      const docSnap = await getDoc(userUsageRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentCount = data.count || 0;

        // Check if limit exceeded
        if (currentCount >= maxUsesPerDay) {
          throw new Error(
            `Daily limit of ${maxUsesPerDay} scans reached! ` +
            `Resets at midnight (${resetTime.toLocaleTimeString()}).`
          );
        }

        // Increment usage count
        await updateDoc(userUsageRef, {
          count: currentCount + 1,
          lastUsed: serverTimestamp(),
          userId: userId
        });

        return {
          success: true,
          currentCount: currentCount + 1,
          remaining: maxUsesPerDay - (currentCount + 1),
          resetTime: resetTime.toLocaleTimeString()
        };

      } else {
        // First use today - create new document
        await setDoc(userUsageRef, {
          count: 1,
          date: today,
          userId: userId,
          firstUsed: serverTimestamp(),
          lastUsed: serverTimestamp()
        });

        return {
          success: true,
          currentCount: 1,
          remaining: maxUsesPerDay - 1,
          resetTime: resetTime.toLocaleTimeString()
        };
      }

    } catch (error) {
      // If it's our daily limit error, re-throw it
      if (error.message.includes('Daily limit')) {
        throw error;
      }
      // For other errors, log and throw a generic error
      console.error('Error checking daily limit:', error);
      throw new Error('Unable to verify usage limit. Please try again.');
    }
  },

  // Get current usage stats for display
  async getCurrentUsage(maxUsesPerDay = 10) {
    try {
      const userId = this.generateUserId();
      const today = new Date().toISOString().split('T')[0];
      const docId = `${userId}_${today}`;
      const userUsageRef = doc(db, 'dailyUsage', docId);

      const docSnap = await getDoc(userUsageRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          used: data.count || 0,
          remaining: maxUsesPerDay - (data.count || 0),
          total: maxUsesPerDay
        };
      } else {
        return {
          used: 0,
          remaining: maxUsesPerDay,
          total: maxUsesPerDay
        };
      }
    } catch (error) {
      console.error('Error getting current usage:', error);
      return {
        used: 0,
        remaining: maxUsesPerDay,
        total: maxUsesPerDay
      };
    }
  }
};

// Export the app instance
export default app;