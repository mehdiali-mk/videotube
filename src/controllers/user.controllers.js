import ApiResponse from "../utils/apiResonse.utils.js";
import ApiError from "../utils/apiError.utils.js";
import asyncHandler from "../utils/asyncHandler.utils.js";
import { User } from "../models/user.models.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.utils.js";

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

export { registerUser, loginUser };
