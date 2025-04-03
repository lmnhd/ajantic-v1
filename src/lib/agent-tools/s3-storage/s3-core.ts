"use server";

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export async function S3_storeFileToS3(file: any, fileExtension: string = ".txt", contentType?: string): Promise<string> {
  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS as string,
    },
  });
  try {
    const upload = new Upload({
      client: client,
      params: {
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: `${Date.now()}_${fileExtension}`,
        Body: Buffer.from(file),
        Expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),// 3 days
        ContentType: contentType || "text/plain",
      },
    });
    const result = await upload.done();
    console.log("S3_storeFileToS3 result...", result);
    return result.Location || "";
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to store file to S3: ${error}`);
  }
} 