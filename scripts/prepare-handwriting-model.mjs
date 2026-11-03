import {loadHandwritingModel} from '../server/services/scanning/handwritten-card-ocr.mjs';
const model=await loadHandwritingModel();
console.log('Pinned handwritten OCR model downloaded and loaded successfully.');
await model.dispose();
