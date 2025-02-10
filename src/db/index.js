import mongoose from "mongoose";
import { DATABASE_NAME } from "../constants.js";

const connectDatabase = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DATABASE_NAME}`);

        console.log("\nDatabase connected successfully...");
    } catch (error) {
        console.log("\nDatabase not connected...\n", error);
    }
};

export default connectDatabase;
