import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import { Readable } from "stream";


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const extractPublicIdFromUrl = (url) => {
    const parts = url.split('/');
    const versionIndex = parts.findIndex(part => part.startsWith('v') && !isNaN(part.slice(1)));
    const publicIdWithExtension = parts.slice(versionIndex + 1).join('/');
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ""); // Remove extension
    return publicId;
};

/**
 * Upload file buffer directly to Cloudinary (recommended for serverless)
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<Object|null>} Cloudinary response or null on error
 */
const uploadBufferToCloudinary = async (buffer, options = {}) => {
    try {
        if (!buffer) return null;

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "auto",
                    ...options
                },
                (error, result) => {
                    if (error) {
                        console.error('❌ Cloudinary buffer upload failed:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );

            // Convert buffer to stream and pipe to Cloudinary
            const readableStream = Readable.from(buffer);
            readableStream.pipe(uploadStream);
        });
    } catch (error) {
        console.error('❌ Cloudinary buffer upload error:', error);
        return null;
    }
};

/**
 * Legacy function: Upload file from disk path to Cloudinary
 * @deprecated Use uploadBufferToCloudinary for better serverless compatibility
 */
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        try {
            if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath)
            }
        } catch (cleanupErr) {
            console.warn('⚠️ Failed to remove temp file after successful upload:', localFilePath, cleanupErr);
        }
        return response;

    } catch (error) {
        // Log the Cloudinary upload error for debugging
        console.error('❌ Cloudinary upload failed for:', localFilePath, error);
        try {
            if (fs.existsSync(localFilePath)) {
                fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
            }
        } catch (cleanupErr) {
            console.warn('⚠️ Failed to remove temp file after failed upload:', localFilePath, cleanupErr);
        }
        return null;
    }
}

const deleteOnCloudinary = async (publicId, resourceType = "image") => {
    try {
        const result = await cloudinary.uploader.destroy(publicId,{resource_type: resourceType});
        console.log("Cloudinary file deleted:", result);
        return result; 
    } catch (error) {
        console.error("Failed to delete from Cloudinary:", error);
        return null;
    }
};



export {extractPublicIdFromUrl, uploadOnCloudinary, uploadBufferToCloudinary, deleteOnCloudinary}