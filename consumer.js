require('dotenv').config();
const { Kafka } = require('kafkajs');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/logs';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9090';

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected for Consumer"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

const LogSchema = new mongoose.Schema({
    level: String,
    message: String,
    timestamp: Date
});
const Log = mongoose.model('Log', LogSchema);

const kafka = new Kafka({ clientId: 'consumer', brokers: [KAFKA_BROKER] });
const consumer = kafka.consumer({ groupId: 'log-group' });

async function consumeLogs() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'log-topic', fromBeginning: false }); // ✅ Consume only new messages

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const logData = JSON.parse(message.value.toString());
                console.log("📥 Processing Log:", logData);

                // ✅ Insert only if the log doesn't exist (avoid duplicates)
                await Log.updateOne(
                    { _id: logData._id },  // Match existing document
                    logData,               // Update with new data
                    { upsert: true }       // Insert if not found
                );

            } catch (error) {
                console.error("❌ Error processing log:", error);
            }
        }
    });
}

consumeLogs().catch(err => console.error("❌ Consumer Error:", err));
