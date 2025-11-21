/**
 * StorageService - Manages offline data persistence using IndexedDB
 * Automatically caches drawings and messages, with sync capabilities
 */

const DB_NAME = 'whiteboard-cache';
const DB_VERSION = 1;
const STORE_NAME = 'events';

class StorageService {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB database
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized:', DB_NAME);
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          
          // Create indexes for efficient querying
          objectStore.createIndex('sessionChannel', ['sessionName', 'channelName'], { unique: false });
          objectStore.createIndex('eventType', 'eventType', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          
          console.log('✅ IndexedDB object store created');
        }
      };
    });
  }

  /**
   * Ensure DB is ready before operations
   */
  async ensureReady() {
    if (!this.db) {
      await this.initPromise;
    }
  }

  /**
   * Cache a drawing event
   */
  async cacheDrawing(sessionName, channelName, drawPayload) {
    try {
      await this.ensureReady();
      
      const event = {
        sessionName,
        channelName,
        eventType: 'DRAW',
        data: drawPayload,
        timestamp: new Date().toISOString(),
        synced: false, // Track if already synced to server
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.add(event);

        request.onsuccess = () => {
          console.log('💾 Drawing cached locally:', drawPayload.type);
          resolve(event);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error caching drawing:', error);
    }
  }

  /**
   * Cache a chat message
   */
  async cacheChatMessage(sessionName, channelName, chatMessage) {
    try {
      await this.ensureReady();
      
      const event = {
        sessionName,
        channelName,
        eventType: 'CHAT',
        data: chatMessage,
        timestamp: new Date().toISOString(),
        synced: false,
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.add(event);

        request.onsuccess = () => {
          console.log('💾 Chat message cached locally');
          resolve(event);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error caching chat message:', error);
    }
  }

  /**
   * Get all cached drawings for a session/channel
   */
  async getCachedDrawings(sessionName, channelName) {
    try {
      await this.ensureReady();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('sessionChannel');
        const range = IDBKeyRange.only([sessionName, channelName]);
        const request = index.getAll(range);

        request.onsuccess = () => {
          const results = request.result.filter(e => e.eventType === 'DRAW');
          console.log(`📦 Retrieved ${results.length} cached drawings`);
          resolve(results.map(r => r.data));
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting cached drawings:', error);
      return [];
    }
  }

  /**
   * Get all cached chat messages for a session/channel
   */
  async getCachedMessages(sessionName, channelName) {
    try {
      await this.ensureReady();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('sessionChannel');
        const range = IDBKeyRange.only([sessionName, channelName]);
        const request = index.getAll(range);

        request.onsuccess = () => {
          const results = request.result.filter(e => e.eventType === 'CHAT');
          console.log(`📦 Retrieved ${results.length} cached messages`);
          resolve(results.map(r => r.data));
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting cached messages:', error);
      return [];
    }
  }

  /**
   * Merge cached data with server data (avoid duplicates)
   */
  mergeData(cachedData, serverData, key = 'timestamp') {
    const serverSet = new Set(serverData.map(item => JSON.stringify(item)));
    const merged = [...serverData];

    // Add cached items not in server
    cachedData.forEach(item => {
      if (!serverSet.has(JSON.stringify(item))) {
        merged.push(item);
      }
    });

    // Sort by timestamp if available
    if (merged.length > 0 && merged[0][key]) {
      merged.sort((a, b) => new Date(a[key]) - new Date(b[key]));
    }

    return merged;
  }

  /**
   * Clear cache for a session/channel
   */
  async clearCache(sessionName, channelName) {
    try {
      await this.ensureReady();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('sessionChannel');
        const range = IDBKeyRange.only([sessionName, channelName]);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            console.log('🗑️ Cache cleared');
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get storage stats
   */
  async getStats() {
    try {
      await this.ensureReady();

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = () => {
          const items = request.result;
          const drawings = items.filter(i => i.eventType === 'DRAW').length;
          const messages = items.filter(i => i.eventType === 'CHAT').length;
          
          resolve({
            totalItems: items.length,
            drawings,
            messages,
            size: new Blob([JSON.stringify(items)]).size,
          });
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      return { totalItems: 0, drawings: 0, messages: 0, size: 0 };
    }
  }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;
