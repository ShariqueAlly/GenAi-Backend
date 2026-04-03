const userModel = require("../model/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const tokenBlackListModel = require("../model/blacklist.model")

const isProduction = process.env.NODE_ENV === "production";
const authCookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
};



/**
 * @name registerUserController
 * @description Register a new user, expects a username email and password
 * @access public  
 */

async function registerUserController(req, res) {
    const {username, email, password } = req.body
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPassword = typeof password === "string" ? password : "";

    if(!normalizedUsername || !normalizedEmail || !normalizedPassword){
        return res.status(400).json({
            message:"Please Provide username email password"
        })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(normalizedEmail)){
        return res.status(400).json({
            message:"Please provide a valid email address"
        })
    }

    const hasUpper = /[A-Z]/.test(normalizedPassword);
    const hasLower = /[a-z]/.test(normalizedPassword);
    const hasNumber = /[0-9]/.test(normalizedPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(normalizedPassword);
    if(normalizedPassword.length < 8 || !hasUpper || !hasLower || !hasNumber || !hasSpecial){
        return res.status(400).json({
            message:"Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
        })
    }
    const isUserAlreadyExist = await userModel.findOne({
        $or: [{username: normalizedUsername}, {email: normalizedEmail}]
    })

    if(isUserAlreadyExist){
        return res.status(400).json({
            message:"Account already exists with this usernme or emailaddress"
        })
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password:hash
    })

    res.status(201).json({
        message:"user registered successfully, please login",
        user:{
            id:user._id,
            username:user.username,
            email:user.email
        }
    })

}

/**
 * @name loginController
 * @description login a user, expects email and password in the request body
 * @access Public
 */
async function loginController(req, res){
    const {email, password} = req.body;
    const user = await userModel.findOne({email})

    if(!user){
        return res.status(400).json({
            message:"Invalid email or password"
        })
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if(!isPasswordValid){
        return res.status(400).json({
            message:"Invalid Password"
        })
    }

   const token = await jwt.sign(
        {id:user._id, username:user.username},
        process.env.JWT_SECRET,
        {expiresIn:"1d"}
    )
    res.cookie("token", token, authCookieOptions)
    res.status(201).json({
        message:"user loggedIn successfully",
        token,
        user:{
            id:user._id,
            username:user.username,
            email:user.email
        }
    })

}

/**
 * @name logout
 */
async function logoutController(req, res){
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const token = req.cookies.token || bearerToken;

    if(token){
        await tokenBlackListModel.create({token})
    }
    res.clearCookie("token", authCookieOptions);
    res.status(200).json({
        message:"User logged out successfully"
    })


}

/**
 * @name authGetMeController
 * @description expects the token in the request cookie and get the current logged in user details
 */
async function authGetMeController(req, res){
 const user = await userModel.findById(req.user.id);

 res.status(201).json({
    message:"user details fetched successfully",
    user:{
        id:user._id,
        username:user.username,
        email:user.email
    }
 })
}

module.exports = { 
    registerUserController,
    loginController,
    logoutController,
    authGetMeController
}
