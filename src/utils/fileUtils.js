import fs from 'fs/promises';
import path from 'path';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('FileUtils');

export class FileUtils {
  /**
   * Ensure directory exists, create if it doesn't
   */
  static async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
      logger.debug(`Directory exists: ${dirPath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`Creating directory: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });
        logger.debug(`Directory created: ${dirPath}`);
      } else {
        logger.error(`Directory access error: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Clear directory contents
   */
  static async clearDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      await Promise.all(
        files.map(file => fs.unlink(path.join(dirPath, file)))
      );
      logger.debug(`Directory cleared: ${dirPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to clear directory: ${error.message}`);
        throw error;
      }
    }
  }
  /**
   * Read JSON file with error handling
   */
  static async readJsonFile(filePath, defaultValue = {}) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      logger.error(`File read error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Write JSON file with error handling and atomic writes
   */
  static async writeJsonFile(filePath, data) {
    try {
      // Ensure directory exists
      await this.ensureDir(path.dirname(filePath));
      
      // Write to temporary file first (atomic write)
      const tempFile = `${filePath}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
      
      // Move temp file to final location
      await fs.rename(tempFile, filePath);
      
    } catch (error) {
      logger.error(`File write error: ${error.message}`);
      throw error;
    }
  }
}