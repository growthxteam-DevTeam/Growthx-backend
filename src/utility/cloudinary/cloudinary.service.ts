import { Readable } from 'stream';

import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { UploadApiResponse, v2 as CloudinaryClient } from 'cloudinary';

import { CLOUDINARY } from './cloudinary.constants';

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryClient) {}

  uploadImage(file: Express.Multer.File, folder: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(new InternalServerErrorException(error?.message ?? 'Image upload failed'));
            return;
          }
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }
}
