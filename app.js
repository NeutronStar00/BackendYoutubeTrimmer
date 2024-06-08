const express = require('express');
const bodyParser = require('body-parser');
const ytdl = require('youtube-dl-exec');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path);

// Initialize Express app
const app = express();
app.use(bodyParser.json());
const port = process.env.PORT || 10000; // Use environment variable for port

app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to generate a unique filename
const generateFilename = () => {
  const timestamp = Date.now();
  return `video_${timestamp}`;
};

// Function to merge video and audio using ffmpeg
const mergeFiles = (videoPath, audioPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions('-c copy') // Copy codec (no re-encoding)
      .save(outputPath)
      .on('end', () => {
        // Remove the separate video and audio files after merging
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

// Function to trim the video
const trimVideo = (inputFilePath, outputFilePath, startTime, endTime) => {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    ffmpeg(inputFilePath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputFilePath)
      .on('end', () => {
        console.log('Trimming finished');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error trimming video:', err);
        reject(err);
      })
      .run();
  });
};

app.get('/', (req, res) => {
  res.send("Server is working!");
});

// Endpoint to handle trimming requests
// Endpoint to handle trimming requests
// Endpoint to handle trimming requests
app.post('/trim', async (req, res) => {
  const { url, start, end } = req.body;
  const outputDir = path.join(__dirname, generateFilename());
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    console.log('Starting video download...');
    const videoFilename = generateFilename() + '.mp4';
    const audioFilename = generateFilename() + '.m4a';
    const videoPath = path.join(outputDir, videoFilename);
    const audioPath = path.join(outputDir, audioFilename);

    console.log(`Video Path: ${videoPath}`);
    console.log(`Audio Path: ${audioPath}`);

    // Download video and audio separately
    const videoPromise = ytdl(url, { format: 'bestvideo[ext=mp4]', output: videoPath })
      .then(output => console.log(`Video downloaded: ${output}`))
      .catch(err => { throw new Error(`Error downloading video: ${err}`) });

    const audioPromise = ytdl(url, { format: 'bestaudio[ext=m4a]', output: audioPath })
      .then(output => console.log(`Audio downloaded: ${output}`))
      .catch(err => { throw new Error(`Error downloading audio: ${err}`) });

    await Promise.all([videoPromise, audioPromise]);

    console.log('Video download completed!');

    // Check if files exist after download
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist: ${videoPath}`);
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file does not exist: ${audioPath}`);
    }

    // Log contents of the directory
    console.log(`Contents of directory ${outputDir}:`);
    fs.readdirSync(outputDir).forEach(file => {
      console.log(file);
    });

    const mergedPath = path.join(outputDir, 'merged_video.mp4');
    await mergeFiles(videoPath, audioPath, mergedPath);

    const trimmedOutputPath = path.join(outputDir, 'output.mp4');
    await trimVideo(mergedPath, trimmedOutputPath, start, end);

    const downloadUrl = `https://backendyoutubetrimmer.onrender.com/${outputDir}/output.mp4`;
    res.json({ downloadUrl });

    setTimeout(() => {
      deleteVideoDirectory(outputDir);
    }, 60 * 10 * 1000); // 10 minutes in milliseconds
  } catch (err) {
    console.error('Error occurred:', err);
    res.status(500).json({ error: 'Error processing video' });
  }
});



// Serve the trimmed videos
app.use(express.static(path.join(__dirname, 'videos')));

// Function to delete the video directory
const deleteVideoDirectory = (dirPath) => {
  fs.rmdirSync(dirPath, { recursive: true });
  console.log(`Deleted directory: ${dirPath}`);
};

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
