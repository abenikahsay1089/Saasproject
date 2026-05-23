import fs from 'fs';
import path from 'path';
import { uploadsRoot } from '../middleware/upload.js';

/** Removes a stored avatar file from disk (ignores external URLs). */
export function deleteAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.includes('/api/uploads/avatars/')) return;
  const filename = path.basename(avatarUrl);
  const filePath = path.join(uploadsRoot, 'avatars', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
