const mongoose = require("mongoose");
const connectDB=async()=>{
    try{
        await mongoose
          .connect(
            "mongodb+srv://vishukac:Vishukac%4022@cluster0.d4gksa4.mongodb.net/sample_mflix"
          )
          .then(console.log("MongoDB connected"));
    }catch(error){
        console.log(error.message)
    }
}
module.exports = connectDB;