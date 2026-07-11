const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    link: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    aiSummaryStatus: {
      type: String,
      enum: ['pending', 'done', 'failed', 'skipped'],
      default: 'pending'
    },
    imageUrl: { type: String, default: '' },
    source: { type: String, required: true }, // e.g. "Daily Nation", "GNews / Reuters"
    region: { type: String, enum: ['kenya', 'world'], required: true, index: true },
    category: {
      type: String,
      enum: ['top', 'politics', 'business', 'sports', 'technology', 'entertainment', 'health', 'world'],
      default: 'top',
      index: true
    },
    isBreaking: { type: Boolean, default: false },
    publishedAt: { type: Date, required: true, index: true },
    notifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

articleSchema.index({ publishedAt: -1 });
articleSchema.index({ region: 1, category: 1, publishedAt: -1 });

module.exports = mongoose.model('Article', articleSchema);
