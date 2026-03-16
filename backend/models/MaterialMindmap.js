const mongoose = require('mongoose');
const { Schema } = mongoose;

const conceptSchema = new Schema({
    name: { type: String, required: true },
    children: { type: [Schema.Types.Mixed], default: [] }
}, { _id: false });

const mindmapSchema = new Schema({
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    teacherId: { type: Number, required: true },
    title: { type: String, required: true },
    concepts: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('MaterialMindmap', mindmapSchema);
