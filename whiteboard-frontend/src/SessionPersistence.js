/**
 * SessionPersistence - Manages session state persistence
 * Saves session info to localStorage so it survives page refresh
 */

const SESSION_KEY = 'whiteboard-session';

class SessionPersistence {
  /**
   * Save session info to localStorage
   */
  saveSession(sessionName, userName, channelName = 'general') {
    const session = {
      sessionName,
      userName,
      channelName,
      timestamp: new Date().toISOString(),
    };
    
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      console.log('💾 Session saved:', sessionName);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Get saved session from localStorage
   */
  getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      if (data) {
        const session = JSON.parse(data);
        console.log('📋 Session restored:', session.sessionName);
        return session;
      }
    } catch (error) {
      console.error('Error getting session:', error);
    }
    return null;
  }

  /**
   * Clear saved session
   */
  clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      console.log('🗑️ Session cleared');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Check if session exists and is valid
   */
  hasValidSession() {
    const session = this.getSession();
    return session && session.sessionName && session.userName;
  }
}

const sessionPersistence = new SessionPersistence();
export default sessionPersistence;
