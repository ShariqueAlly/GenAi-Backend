const mongoose = require("mongoose");

/**
 * --job description
 * --resume text
 * --self description
 * 
 * --Technical Questions and Answers: 
 *                             [{
 *                               question:"",
 *                               intention:"",
 *                               answer:""
 *                              }]
 * 
 * --Behavirol Questions: [{
 *                               question:"",
 *                               intention:"",
 *                               answer:""
 *                              }]
 * 
 * --Skill Gaps:            [{
 *                               skill:"",
 *                               severity:{
 *                               type:string,
 *                               enum:["low","medium", "high"]      
 *                                   }
 *                              }]
 * --prepration plans:   [{
 *                               day:Number,
 *                               focus:String,
 *                               tasks:[String]
 *                        }]
 * 
 */

const technicalQuestionSchema=new mongoose.Schema({
     question:{
        type:String,
        required:[true, "Technical question is required"]
     },
     intention:{
        type:String,
        required:[true,"Intention is required"]
     },
     answer:{
        type:String,
        required:[true, "Abswer is required"]
     }
  
},   {
        _id:false
     })

const behavirolQuestionSchema=new mongoose.Schema({
     question:{
        type:String,
        required:[true, "Technical question is required"]
     },
     intention:{
        type:String,
        required:[true,"Intention is required"]
     },
     answer:{
        type:String,
        required:[true, "Abswer is required"]
     }
  
},   {
        _id:false
     })

const SkillGapsSchema = new mongoose.Schema({
    skill:{
        type:String,
        required:[true, "Skills is required"]
    },

    severity:{
        type:String,
        enum:["low", "medium", "high"]
    }

},{
    _id:false
} 
)

const PreprationPlanSchema = new mongoose.Schema({
    day:{
        type:Number,
        required:[true, "Day is required"]
    },
    focusArea:{
        type:String,
        required:[true, "focus is required"]
    },
    tasks:[
        {
            type:String,
            required:[true, "task is required"]
        }
    ]
},{
    _id:false
} )

// below schema contains the subschena for above schemas
const InterviewReportSchema = new mongoose.Schema({
    jobDescription:{
        type:String,
        required:[true, "Job Description is require"]
    },
    resumeText:{
        type:String,
    },
    selfDescription:{
        type:String,
    },
    matchScore:{
        type:Number,
        min:0,
        max:100
    },
    technicalQuestions:[technicalQuestionSchema],
    behavirolQuestions:[behavirolQuestionSchema],
    skillGaps:[SkillGapsSchema],
    preprationPlan:[PreprationPlanSchema],
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users"
    },
    title:{
        type:String,
        required:[true, "Title is required"]
    }

}, 
 {
        timestamps:true
    })

const InterviewReportModel = mongoose.model("InterviewReport",InterviewReportSchema)

module.exports = InterviewReportModel;
