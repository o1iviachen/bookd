import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Compress an image before uploading.
 * Resizes to maxWidth and compresses to JPEG at given quality.
 */
async function compressImage(
  uri: string,
  maxWidth: number = 1200,
  quality: number = 0.7
): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Convert a local file URI to a blob for upload.
 * Uses XMLHttpRequest which handles all URI schemes (file://, ph://, content://) on React Native.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error(`Failed to convert URI to blob: ${uri}`));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Upload a profile avatar image.
 * Returns the download URL.
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const compressed = await compressImage(uri, 512, 0.8);
  const blob = await uriToBlob(compressed);
  const storageRef = ref(storage, `avatars/${userId}.jpg`);
  await uploadBytesResumable(storageRef, blob);
  return getDownloadURL(storageRef);
}

/**
 * Upload a profile or list header image.
 * Compressed to 1200px wide, stored at the given path.
 */
export async function uploadHeaderImage(storagePath: string, uri: string): Promise<string> {
  const compressed = await compressImage(uri, 1200, 0.8);
  const blob = await uriToBlob(compressed);
  const storageRef = ref(storage, storagePath);
  await uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/**
 * Upload a review image file.
 * Images are compressed before upload.
 * Returns the download URL.
 */
export async function uploadReviewMedia(
  userId: string,
  reviewId: string,
  uri: string,
  mediaType: 'image',
  index: number
): Promise<string> {
  const compressed = await compressImage(uri, 1200, 0.7);
  const blob = await uriToBlob(compressed);
  const fileName = `${Date.now()}_${index}.jpg`;
  const storageRef = ref(storage, `reviews/${userId}/${reviewId}/${fileName}`);
  await uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
