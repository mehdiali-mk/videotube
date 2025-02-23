import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import ApiError from "../utils/apiError.utils.js";
import asyncHandler from "../utils/asyncHandler.utils.js";

export const verifyJwt = asyncHandler(async (request, _, next) => {
    const token =
        request.cookie.refreshToken ||
        request.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized");
    }

    try {
        const decodeToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodeToken?._id).select(
            "-password -refreshToken"
        );

        if (!User) {
            throw new ApiError(401, "Unauthorized.");
        }

        request.user = user;

        next();
    } catch {
        throw new ApiError(401, "Invalid Access Token.");
    }
});
