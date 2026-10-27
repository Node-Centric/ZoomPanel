import fs from 'fs/promises';
import path from 'path';
import type { FileItem, FileContentResponse } from '../../../shared/types.js';

export class FilesService {
  public async listDirectory(targetPath: string): Promise<FileItem[]> {
    const resolvedPath = path.resolve(targetPath);
    await fs.mkdir(resolvedPath, { recursive: true });

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const items: FileItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(resolvedPath, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          permissions: (stat.mode & 0o777).toString(8),
          extension: entry.isDirectory() ? undefined : path.extname(entry.name).toLowerCase(),
        });
      } catch {
        // ignore inaccessible files
      }
    }

    // Sort: directories first, then alphabetically
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public async readFile(filePath: string): Promise<FileContentResponse> {
    const stat = await fs.stat(filePath);
    // 5MB limit for text preview
    if (stat.size > 5 * 1024 * 1024) {
      return {
        path: filePath,
        content: '// File is larger than 5MB and cannot be previewed in editor.',
        size: stat.size,
        isBinary: true,
      };
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        path: filePath,
        content,
        size: stat.size,
        isBinary: false,
      };
    } catch {
      return {
        path: filePath,
        content: '// Binary file preview not supported.',
        size: stat.size,
        isBinary: true,
      };
    }
  }

  public async saveFile(filePath: string, content: string): Promise<boolean> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  }

  public async createDirectory(dirPath: string): Promise<boolean> {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  }

  public async deleteItem(itemPath: string): Promise<boolean> {
    const stat = await fs.stat(itemPath);
    if (stat.isDirectory()) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.unlink(itemPath);
    }
    return true;
  }

  public async bulkDelete(pathsToDelete: string[]): Promise<boolean> {
    for (const itemPath of pathsToDelete) {
      try {
        await this.deleteItem(itemPath);
      } catch (err) {
        console.error(`Error deleting item ${itemPath}:`, err);
      }
    }
    return true;
  }

  public async renameItem(oldPath: string, newPath: string): Promise<boolean> {
    await fs.rename(oldPath, newPath);
    return true;
  }

  public async checkMoveConflicts(sources: string[], destDir: string): Promise<string[]> {
    const conflicts: string[] = [];
    for (const src of sources) {
      const base = path.basename(src);
      const target = path.join(destDir, base);
      try {
        await fs.stat(target);
        conflicts.push(base);
      } catch {
        // target does not exist, good
      }
    }
    return conflicts;
  }

  public async moveItems(sources: string[], destDir: string, overwrite: boolean = false): Promise<{ success: boolean; moved: string[] }> {
    const resolvedDest = path.resolve(destDir);
    const moved: string[] = [];

    for (const src of sources) {
      const resolvedSrc = path.resolve(src);
      if (resolvedSrc === resolvedDest) {
        continue;
      }
      // Prevent moving folder into its own subdirectory
      if (resolvedDest.toLowerCase().startsWith(resolvedSrc.toLowerCase() + path.sep)) {
        throw new Error(`Cannot move folder '${path.basename(src)}' into its own subfolder.`);
      }
      const target = path.join(resolvedDest, path.basename(src));
      if (resolvedSrc === target) {
        continue;
      }
      let targetExists = false;
      try {
        await fs.stat(target);
        targetExists = true;
      } catch {
        targetExists = false;
      }
      if (targetExists) {
        if (!overwrite) {
          throw new Error(`Destination already contains '${path.basename(src)}'.`);
        }
        await fs.rm(target, { recursive: true, force: true });
      }
      await fs.rename(resolvedSrc, target);
      moved.push(target);
    }
    return { success: true, moved };
  }
}

export const filesService = new FilesService();
