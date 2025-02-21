import ApiResponse from "../utils/apiResonse.utils.js";
import ApiError from "../utils/apiError.utils.js";
import asyncHandler from "../utils/asyncHandler.utils.js";
import { User } from "../models/user.models.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.utils.js";

const registerUser = asyncHandler(async (request, response) => {
    const { fullName, email, userName, password } = request.body;

    console.log(fullName);

    if (
        [fullName, email, userName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    const existedUser = await User.findOne({
        $or: [{ userName }, { email }],
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "The user with this email or username is already exists."
        );
    }

    console.warn(request.file);
    const avatarLocalPath = request.files?.avatar?.[0]?.path;
    const coverImageLocalPath = request.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File is required.");
    }

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Avatar is uploaded on cloudinary:", avatar);
    } catch (error) {
        console.log("Error while uploading avatar: ", error);
        throw new ApiError(500, "Avatar is not uploaded.");
    }

    let coverImage = "";
    if (coverImageLocalPath) {
        try {
            coverImage = await uploadOnCloudinary(coverImageLocalPath);
            console.log("Cover Image is uploaded on cloudinary:", coverImage);
        } catch (error) {
            console.log("Error while uploading coverImage: ", error);
            throw new ApiError(500, "Cover Image is not uploaded.");
        }
    }

    try {
        const newUser = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            userName: userName.toLowerCase(),
        });

        const createdUser = await User.findById(newUser._id).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            throw new ApiError(
                500,
                "Something went wrong!! while registering user."
            );
        }

        return response
            .status(201)
            .json(
                new ApiResponse(
                    200,
                    createdUser,
                    "User registered Successfully"
                )
            );
    } catch (error) {
        console.log("User registration failed: ", error);

        if (avatar) {
            await deleteFromCloudinary(avatar.public_id);
        }
        if (coverImage) {
            await deleteFromCloudinary(coverImage.public_id);
        }

        throw new ApiError(
            500,
            "Error while registering user and images were deleted."
        );
    }
});

export { registerUser };
