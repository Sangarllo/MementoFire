// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

import * as functions from 'firebase-functions';

import * as Storage from '@google-cloud/storage';
const gcs = new Storage();

import { tmpdir } from 'os';
import { join, dirname } from 'path';

import * as sharp from 'sharp';
import * as fs from 'fs-extra';

export const generateMini = functions.storage
  .object()
  .onFinalize(async object => {
    const bucket = gcs.bucket(object.bucket);
    const filePath = object.name;
    const fileName = filePath.split('/').pop();
    const bucketDir = dirname(filePath);

    const workingDir = join(tmpdir(), 'mini');
    const tmpFilePath = join(workingDir, 'source.png');

    if (fileName.includes('mini@') || !object.contentType.includes('image')) {
      console.log('exiting function');
      return false;
    }

    // 1. Ensure thumbnail dir exists
    await fs.ensureDir(workingDir);

    // 2. Download Source File
    await bucket.file(filePath).download({
      destination: tmpFilePath
    });

    // 3. Resize the images and define an array of upload promises
    const thumbName = `mini@${fileName}`;
    const thumbPath = join(workingDir, thumbName);
    const SIZE_MINI = 200;

    // Resize source image
    await sharp(tmpFilePath)
        .resize(SIZE_MINI, SIZE_MINI)
        .toFile(thumbPath);

    // 4. Cleanup remove the tmp/thumbs from the filesystem
    fs.remove(workingDir);

    // Upload to GCS
    return bucket.upload(thumbPath, {
        destination: join(bucketDir, thumbName)
    });
  });
