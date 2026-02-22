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
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
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
 * Upload a review media file (image or video).
 * Images are compressed; videos are uploaded as-is (with a size check).
 * Returns the download URL.
 */
export async function uploadReviewMedia(
  userId: string,
  reviewId: string,
  uri: string,
  mediaType: 'image' | 'video',
  index: number
): Promise<string> {
  let blob: Blob;
  let ext: string;

  if (mediaType === 'image') {
    const compressed = await compressImage(uri, 1200, 0.7);
    blob = await uriToBlob(compressed);
    ext = 'jpg';
  } else {
    blob = await uriToBlob(uri);
    ext = 'mp4';
  }

  const fileName = `${Date.now()}_${index}.${ext}`;
  const storageRef = ref(storage, `reviews/${userId}/${reviewId}/${fileName}`);
  await uploadBytesResumable(storageRef, blob);
  return getDownloadURL(storageRef);
}
