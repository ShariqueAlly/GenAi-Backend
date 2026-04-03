require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/database");

async function bootstrap() {
  try {
    await connectDB();

    app.listen(3000, () => {
      console.log("server is running on port no 3000");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();
