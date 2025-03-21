const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const express = require('express')
const path = require('path');
const multer = require('multer');
const { json } = require("stream/consumers");
const app = express();
app.set("view engine",'ejs');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname,"public")))
const storage = multer.diskStorage({
  destination:(req,file,cb)=>{
    return cb(null,"./public/uploads");

  },
  filename: (req,file,cb)=>{
return cb(null,'productimage')
  }
})
const upload = multer({storage})
require("dotenv").config();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
app.get('/', function (req, res) {

    res.render('index')


})
app.post('/result', upload.single('imageFile'),async (req, res) => {
  console.log(req.body.imageFile);
 
res.render("result",{image:`uploads/productimage`});
  // try {
  //   let answer = JSON.parse(await run(`give me a object in javascript and dont write a single thing extra just give this thing {"name":xyz,"cost":xyz} replace xyz with anythign else and dont even write javascirpt in bigning dont declare this too`));
    
  //   // Combine all template variables in one object
  //   res.render('result', {
  //     answer: answer,
  //     image: req.body.imageFile
      
  //   });
  // } catch (error) {
  //   console.error("Error:", error);
  //   res.status(500).send("An error occurred");
  // }
});

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function run(message) {
  const chatSession = model.startChat({
    generationConfig,
    history: [
    ],
  });

  const result = await chatSession.sendMessage(message);
  return result.response.text();
  
}




app.listen(3000);