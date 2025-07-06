// server.js (in backend folder)
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load .env file variables

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware ---
// Enable CORS for your frontend development server
// For production, restrict this to your actual frontend domain
app.use(cors({ origin: 'http://localhost:5173' })); // Allow requests from Vite dev server
app.use(express.json({ limit: '10mb' })); // Allow large JSON payloads (for base64 image)

// --- API Endpoint ---
app.post('/api/detect', async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  const { imageBase64 } = req.body; // Expecting base64 string in request body

  if (!apiKey) {
    console.error('API Key is missing on the server.');
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 data in request.' });
  }

  const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
  const model = "nvidia/neva-22b"; // Or your preferred model
  const stream = false; // Keep it simple for proxying first

  // Construct the prompt including the image data URL
  // The frontend sends the full data URL, so we use it directly here
  const promptContent = `Is this blood sample image indicative of malaria? Respond with only 'Yes' or 'No'. <img src="${imageBase64}" />`;

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  const payload = {
    "model": model,
    "messages": [{ "role": "user", "content": promptContent }],
    "max_tokens": 10,
    "temperature": 0.2,
    "top_p": 0.7,
    "stream": stream
  };

   // Optional: Check estimated image size before sending
   const base64DataForSizeCheck = imageBase64.split(',')[1] || '';
   if (base64DataForSizeCheck.length * 0.75 > 180000) { // ~180KB limit check
        console.warn("Image likely too large, rejecting before API call.");
        return res.status(413).json({ error: "Image file size is too large (max ~180KB)." });
   }

  console.log(`Forwarding request to NVIDIA API for model ${model}...`);

  try {
    const response = await axios.post(invokeUrl, payload, { headers: headers });
    console.log("Received response from NVIDIA API.");
    // Forward the relevant part of the NVIDIA response back to the frontend
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling NVIDIA API:", error.message);
    if (error.response) {
      console.error("NVIDIA API Error Status:", error.response.status);
      console.error("NVIDIA API Error Data:", error.response.data);
      // Forward the error status and data (if available) from NVIDIA API
      res.status(error.response.status).json({
         error: 'Failed to get response from NVIDIA API.',
         detail: error.response.data?.detail || error.message
        });
    } else if (error.request) {
      console.error("No response received from NVIDIA API request:", error.request);
      res.status(502).json({ error: 'No response received from upstream API.' }); // Bad Gateway
    } else {
      console.error("Error setting up NVIDIA API request:", error.message);
      res.status(500).json({ error: 'Internal server error setting up API request.' });
    }
  }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Backend proxy server listening at http://localhost:${port}`);
  if (!process.env.NVIDIA_API_KEY) {
      console.warn("Warning: NVIDIA_API_KEY environment variable is not set!");
  }
});

// Add this line to package.json under "scripts" to use ES Modules:
// "start": "node --experimental-modules server.js"
// Or rename server.js to server.mjs
// Make sure your package.json also has "type": "module"