const recorder = require("node-record-lpcm16");
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const player = require("play-sound")();

const API_URL = "https://api.openai.com/v1/audio/transcriptions";
const API_KEY = "<<openai api key>>"; // Replace with your API key
const SILENCE_THRESHOLD = 2;
const SAVE_PARTIAL = false;
const PLAY_ON_EXIT = false;
const CHUNK_SIZE = 90;
const TIMER = 1000;
const WRITING_DELAY = 80;

class Recorder {
  constructor() {
    this.recording = null;
    this.audioChunks = [];
    this.lastBuffer = null;
  }

  record() {
    this.setupRecording();
    this.recordOnSilence();
    this.processAudioChunks();
  }

  setupRecording() {
    this.recording = recorder.record({
      sampleRate: 44100,
      channels: 2,
      audioSource: "avfoundation",
      device: "BlackHole 2ch",
    });
  }

  recordOnSilence() {
    this.audioChunks = [];
    this.recording.stream().on("data", (chunk) => {
      if (!this.isSilent(chunk)) {
        this.audioChunks.push(chunk);
      }
    });
  }

  processAudioChunks() {
    setInterval(async () => {
      const buffer = this.prepareBuffer();
      if (buffer) {
        if (SAVE_PARTIAL) {
          this.saveAsWav(buffer);
        } else {
          await this.transcribeAudio(buffer);
        }
      }
    }, TIMER);
  }

  async transcribeAudio(buffer) {
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: this.getRandomName(),
      contentType: "audio/wav",
    });
    formData.append("model", "whisper-1");

    const response = await axios.post(API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    const { text } = response.data;
    this.slowType(text, WRITING_DELAY, () => {});
  }

  getRandomName(withBase = false) {
    return `${withBase ? "wavs/" : ""}${Math.random()
      .toString(32)
      .slice(5)}.wav`;
  }

  async stopRecording(play, buffer = null) {
    this.recording.stop();

    let audioBuffer;
    if (!this.lastBuffer) {
      audioBuffer = Buffer.concat(buffer);
      audioBuffer = this.prepareBuffer(audioBuffer);
    } else {
      audioBuffer = buffer;
    }

    if (audioBuffer) {
      if (play) {
        try {
          await this.playAudioBuffer(audioBuffer);
          console.log("Audio buffer played successfully");
        } catch (error) {
          console.error(`Error playing audio buffer: ${error}`);
        }
      } else {
        this.saveAsWav(audioBuffer);
      }
    }
  }

  async onForceExit() {
    console.log("Ctrl+C or Ctrl+D pressed, stopping recording...");
    await this.stopRecording(PLAY_ON_EXIT, this.lastBuffer);
    process.exit();
  }

  async playAudioBuffer(audioBuffer) {
    const tempFilePath = path.join(os.tmpdir(), "temp_audio.wav");
    fs.writeFileSync(tempFilePath, audioBuffer);

    return new Promise((resolve, reject) => {
      player.play(tempFilePath, (error) => {
        fs.unlinkSync(tempFilePath);

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  saveAsWav(wavBuffer) {
    const fileName = this.getRandomName(true);
    fs.writeFileSync(fileName, wavBuffer, {
      encoding: "binary",
    });
    console.log(`Recording saved to ${fileName}`);
  }

  isSilent(chunk) {
    const int16Array = new Int16Array(chunk.buffer);
    const rms = this.calculateRMS(int16Array);
    return rms < SILENCE_THRESHOLD;
  }

  calculateRMS(int16Array) {
    let sum = 0;
    const length = int16Array.length;
    for (let i = 0; i < length; i++) {
      sum += int16Array[i] * int16Array[i];
    }

    return Math.sqrt(sum / length);
  }

  prepareBuffer() {
    if (this.audioChunks.length >= CHUNK_SIZE) {
      const audioBuffer = Buffer.concat(this.audioChunks);
      const dataSize = audioBuffer.length;
      const wavHeader = this.createWavHeader({
        numChannels: 2,
        sampleRate: 44100,
        bitsPerSample: 16,
        dataSize: dataSize,
      });
      const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
      this.lastBuffer = wavBuffer;
      this.audioChunks = [];

      return wavBuffer;
    }
  }

  createWavHeader({ numChannels, sampleRate, bitsPerSample, dataSize }) {
    const buffer = Buffer.alloc(44);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(dataSize + 36, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
  }

  slowType(text, delay, callback) {
    const words = text.split(" ");
    let currentWordIndex = 0;

    function printNextWord() {
      if (currentWordIndex < words.length) {
        process.stdout.write(words[currentWordIndex] + " ");
        currentWordIndex++;
        setTimeout(printNextWord, delay);
      } else {
        console.log(); // Add a newline character after the last word
        if (callback) {
          callback();
        }
      }
    }

    printNextWord();
  }
}

const ff = new Recorder();
ff.record();

process.on("SIGINT", async () => {
  await ff.onForceExit();
});
