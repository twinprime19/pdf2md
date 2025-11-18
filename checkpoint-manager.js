import fs from 'fs/promises';
import path from 'path';

/**
 * Checkpoint Manager for streaming PDF processing
 * Handles checkpoint persistence, recovery, and cleanup operations
 */
export class CheckpointManager {
  static checkpointDir = 'checkpoints';
  static sessionDir = 'temp/sessions';

  /**
   * Save checkpoint data atomically
   * @param {string} sessionId - Unique session identifier
   * @param {Object} data - Checkpoint data
   * @param {number} data.lastPage - Last successfully processed page
   * @param {number} data.totalPages - Total pages in document
   * @param {boolean} data.complete - Whether processing is complete
   * @returns {Promise<void>}
   */
  static async save(sessionId, data) {
    const checkpoint = {
      sessionId,
      lastPage: data.lastPage,
      totalPages: data.totalPages,
      complete: data.complete || false,
      timestamp: Date.now(),
      processingTimes: data.processingTimes || [], // Track per-page processing times for estimates
      errorCount: data.errorCount || 0,
      lastError: data.lastError || null
    };

    const checkpointPath = path.join(this.checkpointDir, `${sessionId}.json`);
    const tempPath = `${checkpointPath}.tmp`;

    try {
      // Ensure checkpoint directory exists
      await fs.mkdir(this.checkpointDir, { recursive: true });

      // Atomic write with backup
      await fs.writeFile(tempPath, JSON.stringify(checkpoint, null, 2));
      await fs.rename(tempPath, checkpointPath);

      console.log(`Checkpoint saved: ${sessionId} - page ${checkpoint.lastPage}/${checkpoint.totalPages}`);
    } catch (error) {
      console.error(`Failed to save checkpoint ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load checkpoint data
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Checkpoint data or null if not found
   */
  static async load(sessionId) {
    try {
      const checkpointPath = path.join(this.checkpointDir, `${sessionId}.json`);
      const data = await fs.readFile(checkpointPath, 'utf8');
      const checkpoint = JSON.parse(data);

      // Validate checkpoint structure
      if (!this.validateCheckpoint(checkpoint)) {
        console.warn(`Invalid checkpoint structure for ${sessionId}`);
        return null;
      }

      return checkpoint;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File not found - normal for new sessions
        return null;
      }
      console.error(`Failed to load checkpoint ${sessionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate checkpoint data structure
   * @param {Object} checkpoint - Checkpoint data to validate
   * @returns {boolean} True if valid
   */
  static validateCheckpoint(checkpoint) {
    return checkpoint &&
           typeof checkpoint.sessionId === 'string' &&
           typeof checkpoint.lastPage === 'number' &&
           typeof checkpoint.totalPages === 'number' &&
           checkpoint.lastPage >= 0 &&
           checkpoint.lastPage <= checkpoint.totalPages &&
           checkpoint.totalPages > 0;
  }

  /**
   * Get session status with extended information
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Detailed session status
   */
  static async getStatus(sessionId) {
    const checkpoint = await this.load(sessionId);

    if (!checkpoint) {
      return {
        status: 'not_found',
        sessionId,
        exists: false
      };
    }

    const status = {
      status: checkpoint.complete ? 'completed' : 'in_progress',
      sessionId: checkpoint.sessionId,
      lastPage: checkpoint.lastPage,
      totalPages: checkpoint.totalPages,
      percentage: Math.round((checkpoint.lastPage / checkpoint.totalPages) * 100),
      complete: checkpoint.complete,
      timestamp: checkpoint.timestamp,
      errorCount: checkpoint.errorCount || 0,
      lastError: checkpoint.lastError,
      exists: true
    };

    // Calculate estimated time remaining
    if (checkpoint.processingTimes && checkpoint.processingTimes.length > 0) {
      const avgTimePerPage = checkpoint.processingTimes.reduce((sum, time) => sum + time, 0) / checkpoint.processingTimes.length;
      const remainingPages = checkpoint.totalPages - checkpoint.lastPage;
      status.estimatedTimeRemaining = Math.round(remainingPages * avgTimePerPage);
      status.avgTimePerPage = Math.round(avgTimePerPage);
    }

    // Check if output file exists
    const outputPath = path.join(this.sessionDir, `${sessionId}.txt`);
    try {
      const stats = await fs.stat(outputPath);
      status.hasOutput = true;
      status.outputPath = outputPath;
      status.outputSize = stats.size;
      status.lastModified = stats.mtime;
    } catch {
      status.hasOutput = false;
    }

    return status;
  }

  /**
   * List all active sessions
   * @returns {Promise<Array>} Array of session information
   */
  static async listSessions() {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const sessions = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const sessionId = path.parse(file).name;
        const status = await this.getStatus(sessionId);

        if (status.exists) {
          sessions.push(status);
        }
      }

      // Sort by last activity (newest first)
      sessions.sort((a, b) => b.timestamp - a.timestamp);

      return sessions;
    } catch (error) {
      console.error(`Failed to list sessions: ${error.message}`);
      return [];
    }
  }

  /**
   * Cleanup old checkpoints and session files
   * @param {number} daysOld - Number of days to consider files old
   * @returns {Promise<Object>} Cleanup statistics
   */
  static async cleanup(daysOld = 7) {
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    const stats = {
      checkpointsRemoved: 0,
      sessionsRemoved: 0,
      errors: []
    };

    // Cleanup checkpoints
    try {
      const checkpointFiles = await fs.readdir(this.checkpointDir);

      for (const file of checkpointFiles) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.checkpointDir, file);
        try {
          const stat = await fs.stat(filePath);

          if (Date.now() - stat.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            stats.checkpointsRemoved++;
            console.log(`Removed old checkpoint: ${file}`);
          }
        } catch (error) {
          stats.errors.push(`Failed to process checkpoint ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to read checkpoint directory: ${error.message}`);
    }

    // Cleanup session files
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
      const sessionFiles = await fs.readdir(this.sessionDir);

      for (const file of sessionFiles) {
        const filePath = path.join(this.sessionDir, file);
        try {
          const stat = await fs.stat(filePath);

          if (Date.now() - stat.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            stats.sessionsRemoved++;
            console.log(`Removed old session file: ${file}`);
          }
        } catch (error) {
          stats.errors.push(`Failed to process session file ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to read session directory: ${error.message}`);
    }

    console.log(`Cleanup completed: ${stats.checkpointsRemoved} checkpoints, ${stats.sessionsRemoved} sessions removed`);

    if (stats.errors.length > 0) {
      console.warn('Cleanup errors occurred:', stats.errors);
    }

    return stats;
  }

  /**
   * Remove specific session and its data
   * @param {string} sessionId - Session to remove
   * @returns {Promise<boolean>} True if successfully removed
   */
  static async removeSession(sessionId) {
    let removed = false;

    try {
      // Remove checkpoint
      const checkpointPath = path.join(this.checkpointDir, `${sessionId}.json`);
      await fs.unlink(checkpointPath);
      removed = true;
      console.log(`Removed checkpoint: ${sessionId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to remove checkpoint ${sessionId}: ${error.message}`);
      }
    }

    try {
      // Remove session output file
      const outputPath = path.join(this.sessionDir, `${sessionId}.txt`);
      await fs.unlink(outputPath);
      removed = true;
      console.log(`Removed session file: ${sessionId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to remove session file ${sessionId}: ${error.message}`);
      }
    }

    try {
      // Remove any remaining page images
      const sessionFiles = await fs.readdir(this.sessionDir);
      const pageFiles = sessionFiles.filter(file => file.startsWith(`${sessionId}_page_`));

      for (const file of pageFiles) {
        await fs.unlink(path.join(this.sessionDir, file));
        console.log(`Removed page file: ${file}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup page files for ${sessionId}: ${error.message}`);
    }

    return removed;
  }

  /**
   * Update checkpoint with additional data (non-destructive merge)
   * @param {string} sessionId - Session identifier
   * @param {Object} updates - Data to merge into checkpoint
   * @returns {Promise<boolean>} True if update successful
   */
  static async update(sessionId, updates) {
    try {
      const existing = await this.load(sessionId);
      if (!existing) {
        console.warn(`Cannot update non-existent checkpoint: ${sessionId}`);
        return false;
      }

      const merged = { ...existing, ...updates, timestamp: Date.now() };
      await this.save(sessionId, merged);
      return true;
    } catch (error) {
      console.error(`Failed to update checkpoint ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get summary statistics for all sessions
   * @returns {Promise<Object>} Statistics summary
   */
  static async getStatistics() {
    const sessions = await this.listSessions();

    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.complete).length,
      inProgressSessions: sessions.filter(s => !s.complete).length,
      totalPagesProcessed: sessions.reduce((sum, s) => sum + s.lastPage, 0),
      totalPagesInQueue: sessions.reduce((sum, s) => sum + s.totalPages, 0),
      errorSessions: sessions.filter(s => s.errorCount > 0).length
    };

    stats.completionRate = stats.totalSessions > 0 ?
      Math.round((stats.completedSessions / stats.totalSessions) * 100) : 0;

    stats.processedPercentage = stats.totalPagesInQueue > 0 ?
      Math.round((stats.totalPagesProcessed / stats.totalPagesInQueue) * 100) : 0;

    return stats;
  }
}