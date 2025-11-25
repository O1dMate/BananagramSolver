import init, { solve } from "./pkg/banana_wasm.js";

// Keep track of if the worker is ready to receive a job
self.is_ready = false;

self.send_result = function(msg) {
  // console.log("WASM msg:", msg);
  postMessage(msg);
}

self.get_random = function() {
  return Math.floor(1000*Math.random());
}

// Init the WASM Module
init().then(() => {
    // Inform the main process we are ready to work
    is_ready = true;
    postMessage('isready');
});

onmessage = async (evt) => {
  // If we aren't ready, do nothing
  if (!is_ready) {
    console.log('[-] Worker not ready!');
    return;
  }

  let letters = evt.data[0] || '';
  let temperature = evt.data[1] || 0.0;

  console.log('Starting solve with:', {letters, temperature});
  let _ = solve(letters, temperature);
  postMessage('done');
}
