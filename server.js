const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const sharp = require("sharp"); // Added sharp for image processing
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

// Routes
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
    const analysisType = req.body.analysisType || 'deep';

    let filePath = originalFilePath;
    let imageBuffer;

    // Process image based on analysis type
    if (analysisType === 'fast') {
      // Compress image
      const compressedFilePath = `public/uploads/compressed_productimage${fileExt}`;
      await sharp(originalFilePath)
        .resize(800, 800, { 
          fit: sharp.fit.inside, 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 70 }) // Compress with 70% quality
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
      }
    });

    // Prepare the prompt with text and image
    const promptParts = [
      { text: `You are analyzing a product image. Your response must be ONLY a valid JSON object with NO text outside the JSON structure.
      
Product type: ${req.body.productType}
User expectations: ${req.body.productExpect}

Examine text, labels, and ingredients visible in the image.
Return EXACTLY this JSON format with no comments, explanations, backticks, or markdown:
{"whatcanyouexpect":" in most simple englsih with few words see what user are expecting from this product and tell if they can expect that or not and also what they can expect",
"rating":"give rating 1 to 10 eg 7/10 like this",
"isproductworthbuying":"yes/no with reason from ingrediants and what user expect and in most simple english with few words ",
"ingredients":{"ingrediantname": ing the biggining analysis deeply if the ingredient is plant based or natural say (natural) if it is of pure chemical say (chemical)  than explain in super easy short words what this ingredient is than tell what this ingredient does in the product in simple language  than brief note on any health considerations all this things should inside this object not be in json format just line by line }}` },
      fileToGenerativePart(imageBuffer, mimeType),
    ];


    // Generate content
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
      analysisType: analysisType
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

// Server startup
app.listen(3000, () => {
  console.log("Server running on port 3000");
});