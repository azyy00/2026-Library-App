require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROFILE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'profiles');
const CLOUDINARY_FOLDER = `${process.env.CLOUDINARY_FOLDER || 'library-app/profiles'}`
  .trim()
  .replace(/^\/+|\/+$/g, '');

const hasCloudinaryCredentials = () => (
  Boolean(process.env.CLOUDINARY_CLOUD_NAME)
  && Boolean(process.env.CLOUDINARY_API_KEY)
  && Boolean(process.env.CLOUDINARY_API_SECRET)
);

const isVercelRuntime = () => ['1', 'true'].includes(`${process.env.VERCEL || ''}`.trim().toLowerCase());

const getStorageMode = () => {
  const preferredMode = `${process.env.FILE_STORAGE || ''}`.trim().toLowerCase();

  if (preferredMode === 'local') {
    return 'local';
  }

  if (preferredMode === 'cloudinary' && hasCloudinaryCredentials()) {
    return 'cloudinary';
  }

  return hasCloudinaryCredentials() ? 'cloudinary' : 'local';
};

const usesCloudinaryStorage = () => getStorageMode() === 'cloudinary';
const usesLocalStorage = () => getStorageMode() === 'local' && !isVercelRuntime();

const ensureLocalUploadDir = () => {
  if (!fs.existsSync(PROFILE_UPLOAD_DIR)) {
    fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
  }

  return PROFILE_UPLOAD_DIR;
};

const getLocalProfileImagePath = (filename) => `/uploads/profiles/${filename}`;

const resolveStoredFilePath = (storedPath) => {
  if (!storedPath || /^https?:\/\//i.test(storedPath)) {
    return '';
  }

  return path.join(__dirname, '..', storedPath.replace(/^\/+/, ''));
};

const removeLocalFile = (storedPath) => {
  const filePath = resolveStoredFilePath(storedPath);

  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error removing uploaded file:', error);
  }
};

const buildCloudinarySignature = (params) => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
};

const uploadToCloudinary = async (file) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `profile-${timestamp}-${Math.round(Math.random() * 1e9)}`;
  const signature = buildCloudinarySignature({
    folder: CLOUDINARY_FOLDER,
    public_id: publicId,
    timestamp
  });
  const formData = new FormData();

  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  formData.append('api_key', process.env.CLOUDINARY_API_KEY);
  formData.append('timestamp', `${timestamp}`);
  formData.append('public_id', publicId);
  formData.append('signature', signature);

  if (CLOUDINARY_FOLDER) {
    formData.append('folder', CLOUDINARY_FOLDER);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Cloudinary upload failed');
  }

  return payload.secure_url || payload.url || '';
};

const extractCloudinaryPublicId = (storedPath) => {
  if (!storedPath || !/^https?:\/\//i.test(storedPath)) {
    return '';
  }

  try {
    const parsedUrl = new URL(storedPath);

    if (parsedUrl.hostname !== 'res.cloudinary.com') {
      return '';
    }

    const uploadMarker = '/upload/';
    const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return '';
    }

    let publicId = parsedUrl.pathname.slice(uploadIndex + uploadMarker.length);
    const versionMatch = publicId.match(/(?:^|\/)v\d+\//);

    if (versionMatch) {
      publicId = publicId.slice(versionMatch.index + versionMatch[0].length);
    }

    return publicId.replace(/\.[^./]+$/, '');
  } catch (error) {
    return '';
  }
};

const removeCloudinaryAsset = async (storedPath) => {
  const publicId = extractCloudinaryPublicId(storedPath);

  if (!publicId || !hasCloudinaryCredentials()) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const formData = new URLSearchParams({
    api_key: process.env.CLOUDINARY_API_KEY,
    public_id: publicId,
    signature: buildCloudinarySignature({ public_id: publicId, timestamp }),
    timestamp: `${timestamp}`
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'Cloudinary deletion failed');
  }
};

const storeUploadedProfileImage = async (file) => {
  if (!file) {
    return '';
  }

  if (usesCloudinaryStorage()) {
    return uploadToCloudinary(file);
  }

  if (isVercelRuntime()) {
    throw new Error('Profile image uploads on Vercel require Cloudinary credentials because the filesystem is temporary.');
  }

  return getLocalProfileImagePath(file.filename);
};

const removeStoredProfileImage = async (storedPath) => {
  if (!storedPath) {
    return;
  }

  if (/^https?:\/\//i.test(storedPath)) {
    await removeCloudinaryAsset(storedPath);
    return;
  }

  removeLocalFile(storedPath);
};

module.exports = {
  ensureLocalUploadDir,
  getStorageMode,
  isVercelRuntime,
  removeStoredProfileImage,
  storeUploadedProfileImage,
  usesCloudinaryStorage,
  usesLocalStorage
};
