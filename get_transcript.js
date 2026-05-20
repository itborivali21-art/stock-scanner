const { YoutubeTranscript } = require('youtube-transcript');
const fs = require('fs');

async function main() {
    try {
        console.log("Fetching transcript...");
        const transcript = await YoutubeTranscript.fetchTranscript('https://youtu.be/n6_AdIqFNk8?si=J1UshU4ZJKo3GYpY');
        fs.writeFileSync('transcript.json', JSON.stringify(transcript, null, 2));
        console.log("Transcript saved to transcript.json");
    } catch (err) {
        console.error("Error fetching transcript:", err);
    }
}

main();
