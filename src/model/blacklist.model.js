const mongoose  = require("mongoose");

const blackistTokenSchema = new mongoose.Schema({
    token:{
        type:String,
        required:[true, "token is required to be added in the bucketlist"]
    }
},
{
    timestamps:true
})

const tokenBlackListModel = mongoose.model("blacklistTokens",blackistTokenSchema);

module.exports = tokenBlackListModel;