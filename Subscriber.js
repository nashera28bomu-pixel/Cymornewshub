const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    // Which categories/regions this browser wants push alerts for.
    // Empty arrays = "all".
    regions: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    breakingOnly: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscriber', subscriberSchema);
