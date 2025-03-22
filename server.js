const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    return cb(null, "./public/uploads");
  },
  filename: (req, file, cb) => {
    // Get the file extension from the original filename
    const fileExt = path.extname(file.originalname);
    // Save as productimage.jpg or productimage.png
    return cb(null, "productimage" + fileExt);
  },
});

const upload = multer({ storage });

require("dotenv").config();
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Function to convert image for Gemini
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

app.post("/result", upload.single("imageFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const fileExt = path.extname(req.file.originalname);
    const filePath = `public/uploads/productimage${fileExt}`;
    const mimeType = req.file.mimetype;

    // Read the uploaded image file
    const imageBuffer = fs.readFileSync(filePath);

    // Create model instance - using a model that supports image analysis
    const visionModel = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.1,
        topP: 0.7,
        topK: 20,
        maxOutputTokens: 1024,
      }
    });

    // Prepare the prompt with text and image - focusing on JSON format
    const promptParts = [
      { text: `You are analyzing a product image. Your response must be ONLY a valid JSON object with NO text outside the JSON structure.
      
Product type: ${req.body.productType}
User expectations: ${req.body.productExpect}

Examine text, labels, and ingredients visible in the image.
Return EXACTLY this JSON format with no comments, explanations, backticks, or markdown:
{"whatcanyouexpect":"what can you expect from this product in 5 words",
"rating":"give rating 1 to 10 eg 7/10 like this",
"isproductworthbuying":"yes/no with reason with only 6-7 words ",
"ingredients":{"ingrediantname":descibe the ingrediants in most simple english possible what that ingrediant do }}` },
      fileToGenerativePart(imageBuffer, mimeType),
    ];

    // Generate content
    const result = await visionModel.generateContent({
      contents: [{ parts: promptParts }],
    });

    let response = result.response.text();
    
    // Process response to ensure it's clean JSON
    response = cleanJsonResponse(response);
    response=JSON.parse(response);

    // Render the result template with image path and AI response
    res.render("result", {
      image: `uploads/productimage${fileExt}`,
      answer: response,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred: " + error.message);
  }
});

// Helper function to clean json response
function cleanJsonResponse(response) {
  // Remove code blocks, backticks, and "json" labels
  let cleaned = response.replace(/```json|```/g, '').trim();
  
  // Try to extract just the JSON object if other text is present
  try {
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd);
    }
    
    // Validate it parses as JSON
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    // If cleaning fails, return original with warning
    return `{"error": "Could not parse response as valid JSON", "rawResponse": ${JSON.stringify(response)}}`;
  }
}

// For text-only requests
const textModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Using flash for text-only for speed
  generationConfig: {
    temperature: 0.2,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
  }
});

async function run(message) {
  // For JSON requests, add specific instruction
  if (message.toLowerCase().includes('json')) {
    message = `Return ONLY a valid JSON object with NO text outside the JSON structure. ${message}`;
  }

  const result = await textModel.generateContent({
    contents: [{ parts: [{ text: message }] }],
  });
  
  const response = result.response.text();
  
  // For text-only responses that should be JSON, clean them too
  if (message.toLowerCase().includes('json')) {
    return cleanJsonResponse(response);
  }
  
  return response;
}

app.listen(3000, () => {
  console.log("Server running on port 3000");
});