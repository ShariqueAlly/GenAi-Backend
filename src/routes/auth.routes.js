const express = require("express");
const authController = require("../controllers/auth.controller");
const authMidlleware = require("../middleware/auth.middleware")


const authRouter = express.Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */

authRouter.post("/register",authController.registerUserController )

/**
 * @route POST/api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authController.loginController);

/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add token in the blaclist
 * @access Public
 */
authRouter.get("/logout", authController.logoutController);

/**
 * @route GET /api/auth/get-me
 * @description get the current logged  in user detals
 * @access Private
 */

authRouter.get("/get-me", authMidlleware.authUser, authController.authGetMeController)
module.exports = authRouter;