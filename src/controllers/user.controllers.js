import ApiResponse from "../utils/apiResonse.utils.js";
import ApiError from "../utils/apiError.utils.js";
import asyncHandler from "../utils/asyncHandler.utils.js";
import { User } from "../models/user.models.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.utils.js";
import jwt from "jsonwebtoken";
import { response } from "express";

const generateAccessAndRefreshToken = async function (userId) {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(
                500,
                "Cannot find user for access and refresh token. " + userId
            );
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken,
        };
    } catch {
        throw new ApiError(
            500,
            "Error occurred while generating access and refresh tokens."
        );
    }
};

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

const loginUser = asyncHandler(async (request, response) => {
    const { email, password, userName } = request.body;

    if (
        [fullName, email, userName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    const user = await User.findOne({
        $or: [{ userName }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User doesn't exists!");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(404, "Incorrect password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const option = {
        httpOnly: true,
        secure: process.env.NODE_DEV === "production",
    };

    return response
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refreshToken, option)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User Logged in successfully..."
            )
        );
});

const logoutUser = asyncHandler(async (request, response) => {
    await User.findByIdAndUpdate(
        request.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_DEV === "production",
    };

    return response
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, "User logged out successfully."));
});

const refreshAccessToken = asyncHandler(async (request, response) => {
    const incomingRefreshToken =
        request.cookie.refreshToken || request.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required.");
    }

    try {
        const decodedRefreshToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedRefreshToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token.");
        }

        if (incomingRefreshToken !== user?.refreshAccessToken) {
            throw new ApiError(401, "Invalid refresh token.");
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_DEV === "production",
        };

        const { accessToken, refreshToken: newRefreshToken } =
            generateAccessAndRefreshToken(user._id);

        return response
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken,
                    },
                    "Access token refreshed successfully."
                )
            );
    } catch (error) {
        throw new ApiError();
    }
});

const changeCurrentPassword = asyncHandler(async (request, response) => {
    const { oldPassword, newPassword } = request.body;

    const user = await User.findById(request.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old Password is invalid.");
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return response
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully."));
});

const getCurrentUser = asyncHandler(async (request, response) => {
    return response
        .status(200)
        .json(new ApiResponse(200, request.user, "Current user details."));
});

const updateAccountDetails = asyncHandler(async (request, response) => {
    const { fullName, email } = request.body;

    if (!fullName || !email) {
        throw new ApiError(404, "Fullname and email are required.");
    }

    const user = await User.findByIdAndUpdate(
        request.user?._id,
        {
            $set: {
                fullName,
                email: email,
            },
        },
        { new: true }
    ).select("-password -refreshToken");

    return response
        .status(200)
        .json(new ApiResponse(200, user, "Details has been updated..."));
});

const updateAvatar = asyncHandler(async (request, response) => {
    const avatarLocalPath = request.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required.");
    }

    const newAvatar = await uploadOnCloudinary(avatarLocalPath);

    if (!newAvatar.url) {
        throw new ApiError(500, "Error while updating avatar on cloudinary.");
    }

    const user = await User.findByIdAndUpdate(
        request.user?._id,
        {
            $set: {
                avatar: newAvatar.url,
            },
        },
        { new: true }
    ).select("-password -refreshToken");

    response
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateCoverImage = asyncHandler(async (request, response) => {
    const coverImageLocalPath = request.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required.");
    }

    const newCoverImage = uploadOnCloudinary(coverImageLocalPath);

    if (!newCoverImage.url) {
        throw new ApiError(
            500,
            "Error while updating cover image on cloudinary."
        );
    }

    const user = await User.findByIdAndUpdate(
        request.user?._id,
        {
            $set: {
                coverImage: newCoverImage.url,
            },
        },
        { new: true }
    ).select("-password -refreshToken");

    response
        .status(200)
        .json(new ApiResponse(200, user, "coverIamge updated successfully."));
});

export { registerUser, loginUser, logoutUser };
