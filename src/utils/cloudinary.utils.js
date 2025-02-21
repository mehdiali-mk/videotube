import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Configure the cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const uploadOnCloudinary = async function (localFilePath) {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        console.log("File uploaded on cloudianry.\nURL: ", response.url);

        fs.unlinkSync("./" + localFilePath);

        return response;
    } catch (error) {
        fs.unlinkSync("./" + localFilePath);
        return null;
    }
};

const deleteFromCloudinary = async function (publicId) {
    try {
        const deleteCloudinary = await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from cloudinary: ", deleteCloudinary);
    } catch (error) {
        console.log("Error while deleting from cloudinary: ", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };
