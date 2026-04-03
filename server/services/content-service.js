const fs = require('fs');
const path = require('path');

function ensureUploadPath(uploadPath) {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
}

function cleanupContentFile(content, uploadPath) {
  if (!content || !content.file_path || !content.file_path.startsWith('/uploads/')) return;
  const fileName = content.file_path.replace('/uploads/', '');
  const fullPath = path.join(uploadPath, fileName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = {
  ensureUploadPath,
  cleanupContentFile,
};
