import { app } from "./app.js";
import connectDatabase from "./db/index.js";

connectDatabase()
    .then(() => {
        app.listen(process.env.PORT, () => {
            console.log(
                "Server is running on port number = ",
                process.env.PORT
            );
        });
    })
    .catch((error) => {
        console.log("\nError while connecting mongodb.\n", error);
    });
