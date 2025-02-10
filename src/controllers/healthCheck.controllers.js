import ApiResponse from "../utils/apiResonse.utils.js";
import asyncHandler from "../utils/asyncHandler.utils.js";

const healthCheck = asyncHandler(async (request, response) => {
    return response.json(new ApiResponse(200, "OK", "Health checked..."));
});

export default healthCheck;
