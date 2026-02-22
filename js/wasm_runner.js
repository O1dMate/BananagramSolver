import init, { solve } from "./pkg/banana_wasm.js";

// Keep track of if the worker is ready to receive a job
self.is_ready = false;

self.send_result = function(msg) {
	// console.log("WASM msg:", msg);

	if (msg.startsWith('log:')) {
		console.log(msg.slice(4));
		return;
	}

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
	let longest_word_first = evt.data[2] ?? false;
	let required_word = evt.data[3] || '';

	console.log('Starting solve with:', {letters, temperature, longest_word_first, required_word});
	let _ = solve(letters, temperature, longest_word_first, required_word);
	postMessage('done');
}
