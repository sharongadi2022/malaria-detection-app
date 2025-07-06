import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css'; // Import component-specific styles

function App() {
  // State variables
  const [selectedFile, setSelectedFile] = useState(null); // Stores the File object
  const [imageBase64, setImageBase64] = useState(''); // Stores the base64 data URL for preview and sending
  const [result, setResult] = useState(''); // Stores the API result text ("Yes"/"No")
  const [isLoading, setIsLoading] = useState(false); // Tracks if the API call is in progress
  const [error, setError] = useState(''); // Stores any error messages

  // --- Configuration ---
  // URL of your backend proxy server endpoint
  const backendUrl = "http://localhost:3001/api/detect"; // Make sure this matches your running backend

  // --- Event Handlers ---

  // Handles file selection from the input
  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];

    // Reset previous state
    setSelectedFile(null);
    setImageBase64('');
    setResult('');
    setError('');

    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file); // Keep track of the file object

      // Create a FileReader to read the file content
      const reader = new FileReader();

      // Define what happens when the file is successfully read
      reader.onloadend = () => {
        // reader.result contains the file content as a data URL (e.g., "data:image/png;base64,...")
        setImageBase64(reader.result);
      };

      // Define what happens if there's an error reading the file
      reader.onerror = () => {
        console.error("Error reading the file.");
        setError('Failed to read the image file. Please try again.');
      };

      // Read the file as a Data URL (which includes Base64 encoding)
      reader.readAsDataURL(file);

    } else if (file) {
      // Handle cases where a file is selected but it's not an image
      setError('Please select a valid image file (e.g., PNG, JPG).');
    }
    // If no file is selected, state is already reset
  }, []); // Empty dependency array means this function is created once

  // Handles the submission to the backend API
  const handleSubmit = async () => {
    if (!imageBase64) {
      setError('Please select an image first.');
      return; // Exit if no image is ready
    }
    if (isLoading) {
      return; // Prevent multiple submissions
    }

    // Set loading state and clear previous results/errors
    setIsLoading(true);
    setResult('');
    setError('');

    console.log("Sending request to backend proxy:", backendUrl);

    try {
      // Make the POST request to the backend proxy server
      const response = await axios.post(
        backendUrl,
        { imageBase64: imageBase64 }, // Send the full data URL in the request body
        {
          headers: { 'Content-Type': 'application/json' },
          // Optional: Add a timeout
          // timeout: 30000 // 30 seconds
        }
      );

      console.log("Response received from backend:", response.data);

      // --- Process the response from the backend ---
      // Assuming the backend forwards the NVIDIA API response structure
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content.trim();

        // Simple check for "Yes" or "No" in the response
        // Make it case-insensitive and check for inclusion
        if (content.toLowerCase().includes('yes')) {
          setResult('Malaria Detected: Yes');
        } else if (content.toLowerCase().includes('no')) {
          setResult('Malaria Detected: No');
        } else {
          // Handle unexpected but valid responses from the model
          setResult(`Analysis complete. Response: ${content}`);
          console.warn("Received unexpected content format:", content)
        }
      } else if (response.data.error) {
         // Handle specific error structure possibly returned by *your* backend
         setError(`Backend Error: ${response.data.error} ${response.data.detail || ''}`);
         console.error("Backend returned an error object:", response.data);
      } else {
        // Handle cases where the response format is not what we expected
        setError('Received an unexpected response format from the server.');
        console.error("Unexpected response format:", response.data);
      }

    } catch (err) {
      console.error("Error calling backend API:", err);
      let friendlyError = 'An error occurred during analysis.';

      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx (error from backend)
        console.error("Backend Error Status:", err.response.status);
        console.error("Backend Error Data:", err.response.data);
        friendlyError = `Analysis failed (Status ${err.response.status}): ${err.response.data?.error || err.response.data?.detail || 'Server error'}.`;
        if (err.response.status === 413) {
          friendlyError = "The uploaded image is too large. Please try a smaller file.";
        }
      } else if (err.request) {
        // The request was made but no response was received (network issue, backend down)
        console.error("No response received:", err.request);
        friendlyError = 'Could not connect to the analysis server. Please check your connection or try again later.';
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Request setup Error:', err.message);
        friendlyError = `An unexpected error occurred: ${err.message}`;
      }
      setError(friendlyError);
    } finally {
      // Always turn off loading indicator regardless of success or failure
      setIsLoading(false);
    }
  };

  // --- Render JSX ---
  return (
    <div className="App">
      <h1>Malaria Detection AI</h1>
      <p>Upload a blood sample image to check for Malaria parasites.</p>

      {/* File Upload Section */}
      <div className="upload-section">
        <label htmlFor="file-upload" className="custom-file-upload">
          {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to Upload Image'}
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/png, image/jpeg, image/webp" // Be specific about accepted types
          onChange={handleFileChange}
          disabled={isLoading} // Disable upload while loading
        />
      </div>

      {/* Display error messages */}
      {error && <div className="status-message error">{error}</div>}

      {/* Image Preview and Analyze Button Section (only show if an image is loaded) */}
      {imageBase64 && (
        <div className="preview-section">
          <h2>Image Preview</h2>
          <img
            src={imageBase64}
            alt="Blood sample preview"
            className="preview-image"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="analyze-button"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Image'}
          </button>
        </div>
      )}

      {/* Display loading indicator */}
      {isLoading && <div className="status-message loading">Processing image, please wait...</div>}

      {/* Display the result */}
      {result && <div className="status-message result"><h2>{result}</h2></div>}

    </div>
  );
}

export default App;