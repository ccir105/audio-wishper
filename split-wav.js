const fs = require('fs');
const wavefile = require('wavefile');

const filePath = './output.wav'; // Replace with the path to your audio file
const outputDir = './output'; // Replace with the path to your output directory
const chunkDurationInSeconds = 3 * 60; // 3 minutes

function splitAudio() {
    const fileBuffer = fs.readFileSync(filePath);
    let wav = new wavefile.WaveFile();
    wav.fromBuffer(fileBuffer);

    const bytesPerSample = wav.fmt.bitsPerSample / 8;
    const blockAlign = wav.fmt.numChannels * bytesPerSample;
    const samplesPerChunk = wav.fmt.sampleRate * chunkDurationInSeconds;
    const numChunks = Math.ceil(wav.data.samples.length / (samplesPerChunk * blockAlign));

    for (let i = 0; i < numChunks; i++) {
        const chunk = new wavefile.WaveFile();
        const start = i * samplesPerChunk * blockAlign;
        const end = (i + 1) * samplesPerChunk * blockAlign;
        const slicedSamples = wav.data.samples.slice(start, end);

        chunk.fromScratch(wav.fmt.numChannels, wav.fmt.sampleRate, wav.bitDepth, slicedSamples);

        const outputPath = `${outputDir}/chunk-${i + 1}.wav`;
        fs.writeFileSync(outputPath, Buffer.from(chunk.toBuffer()));
        console.log(`Saved chunk ${i + 1} at ${outputPath}`);
    }
}

splitAudio();
