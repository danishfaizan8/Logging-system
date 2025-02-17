require('dotenv').config();
const express = require('express');
const { Kafka } = require('kafkajs');
const mongoose = require('mongoose');
const redis = require('redis');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://mongodb:27017/logs')
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB connection error:", err));


// Redis Client
const client = redis.createClient({ url: 'redis://redis:6379' });
client.on('error', err => console.log('❌ Redis Client Error', err));
client.connect().then(() => console.log("✅ Connected to Redis"));

// Log Schema
const LogSchema = new mongoose.Schema({
    level: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});
const Log = mongoose.model('Log', LogSchema);

// Kafka Producer
const kafka = new Kafka({ clientId: 'logger', brokers: ['kafka:9090'] });
const producer = kafka.producer();

async function sendToKafka(log) {
    await producer.connect();
    await producer.send({
        topic: 'log-topic',
        messages: [{ value: JSON.stringify(log) }]
    });
    await producer.disconnect();
}

// API Endpoint
app.post('/log', async (req, res) => {
    try {
        const { level, message } = req.body;
        const log = new Log({ level, message });
        await log.save();
        await sendToKafka(log);
        res.json({ message: "✅ Log received and queued!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "❌ Internal Server Error" });
    }
});

app.listen(4000, () => console.log("🚀 API running on port 4000"));
