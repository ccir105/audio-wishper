const fs = require('fs');
const recorder = require('node-record-lpcm16');
const wav = require('wav');

function init(time, filename) {
    const outputFile = `recordings/${filename}.wav`;
    const recordDuration = 1000 * 60 * time; // Record for 10 seconds

    const fileStream = fs.createWriteStream(outputFile);

    const wavWriter = new wav.Writer({
        sampleRate: 16000, // You can adjust the sample rate if needed
        channels: 1,
        bitDepth: 16,
    });

    console.log('Recording started');
    const recording = recorder.record({
        sampleRate: 16000, // Match the sample rate of the wav.Writer
        channels: 1,
        device: null, // Use the default recording device
    });

    recording.stream().pipe(wavWriter).pipe(fileStream);

    setTimeout(() => {
        recording.stop();
        console.log('Recording stopped, saved to', outputFile);
    }, recordDuration);
}

const [,,time, filename] = process.argv;

init(time, filename)
