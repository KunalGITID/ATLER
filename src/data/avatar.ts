// Profile photo: shrunk on the phone to a 256 px square, stored in the
// avatars bucket under the user's own folder, linked from their profile.
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

const SIZE = 256;
// `atler_avatar` is ours; Google's own photo (avatar_url / picture) is the
// fallback. 'none' means the user removed theirs and wants the initial.
export function avatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const mine = meta.atler_avatar as string | null | undefined;
  if (mine === 'none') return null;
  return mine || (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;
}

export class AvatarError extends Error {}

async function squareWebp(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("That file isn't a photo this phone can read.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // Centre crop to a square, then scale down.
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new AvatarError("Couldn't prepare that photo.");
  return blob;
}

export async function setAvatar(user: User, file: File): Promise<void> {
  const blob = await squareWebp(file);
  const path = `${user.id}/avatar.webp`;
  const { error } = await supabase.storage.from('avatars').upload(path, await blob.arrayBuffer(), { upsert: true, contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw new AvatarError("Couldn't upload the photo. Check your connection and try again.");
  // A new version number each time, so phones don't keep showing the old one.
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error: metaError } = await supabase.auth.updateUser({ data: { atler_avatar: url } });
  if (metaError) throw new AvatarError("Couldn't save the photo to your profile.");
}

export async function removeAvatar(user: User): Promise<void> {
  await supabase.storage.from('avatars').remove([`${user.id}/avatar.webp`]);
  const { error } = await supabase.auth.updateUser({ data: { atler_avatar: 'none' } });
  if (error) throw new AvatarError("Couldn't remove the photo.");
}
