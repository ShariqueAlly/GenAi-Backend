const jwt = require("jsonwebtoken");
const tokenBlackListModel = require("../model/blacklist.model")

async function authUser(req, res, next){
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
    const queryToken = req.query?.token;
    const token = cookieToken || bearerToken || queryToken;

    if(!token){
        return res.status(401).json({
            message:"Token Not Provided. Send a cookie or Authorization: Bearer <token>."
        })
    }

    const isTokenBlackList = await tokenBlackListModel.findOne({
        token
    })

    if(isTokenBlackList){
        return res.status(401).json({
            message:"token is invalid"
        })
    }

    try{
    const decoded= jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded
    next();
        
    }catch(err){
        return res.status(401).json({
            message:"Invalid Token"
        })
    }

}

module.exports = {authUser};
