// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
admin.initializeApp();

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

    // 2b. Gets the metadata for the file
    const [metadata] = await bucket.file(filePath).getMetadata();
    console.log(`File: ${metadata.name}`);
    const uploadId = metadata.name.substr(5, 36);

    console.log(`uploadId: ${uploadId}`);

    const contType = metadata.contentType;
    const fileExtension = contType.replace('image/', '.');
    const thumbName = `mini@${fileName}${fileExtension}`;

    // 3. Resize the images and define an array of upload promises
    const thumbPath = join(workingDir, thumbName);
    const SIZE_MINI = 400;

    // Resize source image
    await sharp(tmpFilePath)
        .resize(SIZE_MINI, SIZE_MINI, {
          withoutEnlargement: true
        })
        .toFile(thumbPath);

    // 4. Cleanup remove the tmp/thumbs from the filesystem
    fs.remove(workingDir);

    const customMetadata = {
      app: 'Memento-App-Universal',
      uploadId: metadata.name,
      type: 'MiniSize'
    };

    // Upload to GCS
    const destThumb = join(bucketDir, thumbName);

    return bucket.upload(
      thumbPath, {
        destination: destThumb,
        metadata: customMetadata
    })
    .then((data) => {

      const file = data[0];

      const dataDB = {
        uploadId: uploadId,
        originalSrc: destThumb
      };

      const db = admin.firestore();
      const settings = {/* your settings... */ timestampsInSnapshots: true};
      db.settings(settings);
      db.collection('images').doc(uploadId).set(dataDB);
      console.log(`modificada ${uploadId}`);
    });
});
