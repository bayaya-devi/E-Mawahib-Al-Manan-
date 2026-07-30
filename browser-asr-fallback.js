(function () {
  'use strict';
  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
  const MODEL_ID = 'onnx-community/whisper-small';
  let pipelinePromise = null;
  function resample(channel, sourceRate, targetRate) {
    if (sourceRate === targetRate) return channel;
    const length = Math.max(1, Math.round(channel.length * targetRate / sourceRate));
    const output = new Float32Array(length), ratio = sourceRate / targetRate;
    for (let i = 0; i < length; i++) { const p = i * ratio, l = Math.floor(p), r = Math.min(channel.length - 1, l + 1), w = p - l; output[i] = channel[l] * (1 - w) + channel[r] * w; }
    return output;
  }
  async function decode(blob) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('audio-context-unavailable');
    const context = new Context();
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer()), mono = new Float32Array(buffer.length);
      for (let c = 0; c < buffer.numberOfChannels; c++) { const values = buffer.getChannelData(c); for (let i = 0; i < values.length; i++) mono[i] += values[i] / buffer.numberOfChannels; }
      return resample(mono, buffer.sampleRate, 16000);
    } finally { try { await context.close(); } catch (error) {} }
  }
  async function getPipeline(progress) {
    if (!pipelinePromise) {
      progress('جاري تحضير أداة الاستماع...');
      pipelinePromise = import(MODULE_URL).then(module => module.pipeline('automatic-speech-recognition', MODEL_ID, {
        dtype: 'q8', progress_callback: info => { if (info && info.status === 'progress' && Number.isFinite(info.progress)) progress('جاري تحضير أداة الاستماع ' + Math.round(info.progress) + '%'); }
      })).catch(error => { pipelinePromise = null; throw error; });
    }
    return pipelinePromise;
  }
  async function transcribe(blob, onProgress) {
    const progress = typeof onProgress === 'function' ? onProgress : function () {};
    progress('جاري تجهيز التسجيل...');
    const audio = await decode(blob);
    if (audio.length < 4000) return '';
    const transcriber = await getPipeline(progress);
    progress('جاري تحويل القراءة إلى كلمات...');
    const result = await transcriber(audio, { language: 'arabic', task: 'transcribe', chunk_length_s: 25, stride_length_s: 4 });
    return String(result && result.text || '').trim();
  }
  window.MawahibBrowserAsr = { transcribe };
})();