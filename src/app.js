const express = require("express");


const app = express();
app.use(express.json())

const cors = require("cors");
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({
    origin: allowedOrigin,
    credentials: true
}))

const cookieParser = require("cookie-parser")
app.use(cookieParser()); 

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/*using all the routes here*/
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app;
