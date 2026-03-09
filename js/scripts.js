let SCREEN_WIDTH = 0;
let SCREEN_HEIGHT = 0;

// Drawing functions to handled inverted Y-Axis of the browser
const drawRect = (x, y, w, h) => rect(x, y, w, h);
const drawLine = (x1, y1, x2, y2) => line(x1, y1, x2, y2);
const drawCircle = (x, y, d) => circle(x, y, d);
const drawArc = (x, y, w, h, startAngle, stopAngle) => arc(x, y, w, h, 2*Math.PI-stopAngle, 2*Math.PI-startAngle);
const drawTri = (x1, y1, x2, y2, x3, y3) => triangle(x1, y1, x2, y2, x3, y3);

const NO_CHAR = '.'; // The char that will represent an empty cell in the solution grid
let temperature = 0.0;
let start_with_longest_word = false;
let start_with_specific_word = false;
let deep_search_mode = false;
let current_solution_to_draw = []; // Array of strings. Each string is a row in the solution grid.
let current_solution_known_lowest_score = 0; // The lowest score the solver believes is possible given the letters.
let current_worker_stats = { letters: '', best_score: 1_000_000, start_time: 0n, end_time: 0n, is_running: false, unused_letters: '' };
const worker_count = (() => { try { const core_count = navigator.hardwareConcurrency ?? 1; return core_count;} catch (_) { return 1; } })();
const worker_list = (new Array(worker_count)).fill(null);

function StartSolve() {
	// Terminate any running workers if they're still running
	TerminateAllWorkers();

	// Get entered letters
	let letters = document.getElementById('letters').value;
	let required_word_letters = document.getElementById('required_word').value;

	// Clean entered letters (trim, convert to lowercase, then filter our non-lowercase chars to remove symbols, digits etc).
	let cleaned_letters = letters.trim().toLowerCase().split('').filter(char => char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122).join('');
	let required_word = required_word_letters.trim().toLowerCase().split('').filter(char => char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122).join('');

	// Reset search statistics
	current_solution_to_draw = [];
	current_solution_known_lowest_score = 0;
	current_worker_stats = { letters: '', best_score: cleaned_letters.length, start_time: 0n, end_time: 0n, is_running: false, unused_letters: '' };

	// If there are no letters, don't proceed with the solve
	if (cleaned_letters.length <= 1) {
		return;
	}

	frameRate(60);
	console.log('Starting solve:');

	// Create new workers for this job
	for (let i = 0; i < worker_count; ++i) { worker_list[i] = new Worker("js/wasm_runner.js", {type:"module"}) }

	// console.log('here', worker_list);

	current_worker_stats.is_running = true;
	current_worker_stats.start_time = BigInt(Date.now());

	// Handle messages from the worker
	for (let worker_id = 0; worker_id < worker_count; ++worker_id) {
		worker_list[worker_id].onmessage = (evt) => {
			if (evt.data == 'isready') {
				// Check pre-conditions for the Required Word
				if (!start_with_specific_word || !required_word || required_word.length < 2) { required_word = ''; }

				let solve_temperature = Math.min(Math.max(temperature, 0.0), 1.0); // Clamp Temperature between 0.0 - 1.0
				solve_temperature = solve_temperature*0.5; // Reduce the Temperature to a max of 0.5, since 1 temperature of 1.0 will skip everything.

				worker_list[worker_id].postMessage([cleaned_letters, solve_temperature, start_with_longest_word, required_word, deep_search_mode, worker_id]);
			}
			else if (evt.data.startsWith('newbest')) {
				UpdateBestSolution(evt.data);
			}
			else if (evt.data.startsWith('update_lower_bound_score')) {
				// All workers will call this, but that doesn't matter since they'll all calculate the same value.
				current_solution_known_lowest_score = parseInt(evt.data.split('|')[1]);
			}
			else if (evt.data == 'done') {
				// If this worker completes, we should only cancel it and not any other workers.
				worker_list[worker_id].terminate();
				worker_list[worker_id] = null;

				// We won't mark the search as finished unless all other workers are done.
				if (worker_list.every(worker => worker === null)) {
					current_worker_stats.is_running = false;
					current_worker_stats.end_time = BigInt(Date.now());
					frameRate(5);
				}

				console.log(`Worker ${worker_id} done`);
			}
		}
	}
}

function TerminateAllWorkers() {
	// Terminate any running workers if they're still running
	for (let i = 0; i < worker_count; ++i) {
		if (worker_list[i]) worker_list[i].terminate();
	}
}

function CancelSolve() {
	TerminateAllWorkers();

	if (current_worker_stats.is_running) {
		current_worker_stats.is_running = false;
		current_worker_stats.end_time = BigInt(Date.now());
	}

	frameRate(5);
}

function HandleTemperatureChange() {
	temperature = parseFloat(document.getElementById('temperature').value);
	UpdateTempValueInUi();
}

function HandleStartWithLongestWord() {
	start_with_longest_word = !!document.getElementById('start_with_longest_word').checked;

	if (start_with_longest_word) {
		start_with_specific_word = false;
		document.getElementById('start_with_specific_word').checked = false;
	}
}

function HandleStartWithSpecificWord() {
	start_with_specific_word = !!document.getElementById('start_with_specific_word').checked;

	if (start_with_specific_word) {
		start_with_longest_word = false;
		document.getElementById('start_with_longest_word').checked = false;
	}
}

function HandleDeepSearch() {
	deep_search_mode = !!document.getElementById('use_deep_search').checked;
}

function UpdateTempValueInUi() {
	document.getElementById('temperature_value').innerText = (Math.round(temperature * 1000)/1000).toString();
}

function UpdateBestSolution(msg_from_worker) {
	let pieces = msg_from_worker.split('|');
	// console.log("[+] New Best", pieces[1]);

	const new_best_score_from_worker = parseInt(pieces[1]);


	// Update the best score found
	if (new_best_score_from_worker < current_worker_stats.best_score) {
		current_worker_stats.best_score = new_best_score_from_worker;

		// Update which letters are left over / haven't been used yet
		current_worker_stats.unused_letters = pieces[3].slice(1, pieces[3].length-1).replaceAll(`'`, ``).replaceAll(`(`, `[ `).replaceAll(`)`, ` ]`).replaceAll(`], [`, `]  [`).toUpperCase();

		// Update the current best solution
		current_solution_to_draw = pieces[2].toUpperCase().split('\n');
	}

	// Check if we have a final solution
	if (current_worker_stats.best_score <= current_solution_known_lowest_score) {
		current_worker_stats.end_time = BigInt(Date.now());
		current_worker_stats.is_running = false;

		TerminateAllWorkers();
	}
}

// Initial Setup
function setup() {
	SCREEN_WIDTH = window.innerWidth - 40;
	SCREEN_HEIGHT = window.innerHeight - 100;

	// Get currently set values in the UI as the starting values
	temperature = parseFloat(document.getElementById('temperature').value);
	start_with_longest_word = document.getElementById('start_with_longest_word').checked;
	start_with_specific_word = document.getElementById('start_with_specific_word').checked;
	deep_search_mode = document.getElementById('use_deep_search').checked;
	
	if (start_with_specific_word) {
		start_with_longest_word = false;
	}

	UpdateTempValueInUi();

	// Load the files required for the worker. This is so the files are already loaded when we start a solve, meaning we can start immediately.
	const load_worker_files = new Worker("js/wasm_runner.js", {type:"module"});
	load_worker_files.onmessage = (evt) => {
		if (evt.data == 'isready') {
			console.log('load_worker_files, isready');
			load_worker_files.postMessage(['', 0.0, false, '', false, 0]);
		}
		else if (evt.data == 'done') {
			console.log('load_worker_files, done');
			load_worker_files.terminate();
		}
	};

	createCanvas(window.innerWidth-40, window.innerHeight-100);
	frameRate(5);
}

function windowResized() {
	SCREEN_WIDTH = window.innerWidth - 40;
	SCREEN_HEIGHT = window.innerHeight - 100;
	resizeCanvas(window.innerWidth-40, window.innerHeight-100);
}

function PrettyPrintTimeTaken() {
	if (current_worker_stats.start_time == 0n) return 'N/A';

	let time_diff_in_ms;

	if (current_worker_stats.is_running) {
		time_diff_in_ms = BigInt(Date.now()) - current_worker_stats.start_time;
	} else {
		time_diff_in_ms = current_worker_stats.end_time - current_worker_stats.start_time;
	}

	const seconds = (time_diff_in_ms / 1000n).toString();
	const milliseconds = (time_diff_in_ms % 1000n).toString();

	// Under 1 second
	if (seconds <= 0) {
		return `${milliseconds}ms`;
	}
	// Over 1 second
	else {
		return `${seconds}.${milliseconds.padStart(3,'0')}s`;
	}

}

// To be called each frame
function draw() {
	// TODO: Ideally calculate this properly based on screen size and amount of letters
	let cell_size = 50;
	let offset_x = 30;
	let offset_y = 60;

	// Will the solution fit on the screen?
	let required_width = offset_x + cell_size * ((current_solution_to_draw[0] || []).length+1);
	let required_height = offset_y + cell_size * (current_solution_to_draw.length+1);

	if (required_width > SCREEN_WIDTH || required_height > SCREEN_HEIGHT) {
		SCREEN_WIDTH = required_width;
		SCREEN_HEIGHT = required_height;
		resizeCanvas(required_width,required_height);
	}

	// Draw background & set Rectangle draw mode
	background(255);
	rectMode(CENTER);

	// Draw scene rectangle
	fill(30);
	noStroke();
	drawRect(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);

	// Draw Stats
	let solve_stats_text;
	if (current_worker_stats.start_time === 0n) {
		solve_stats_text = "Enter letters and click 'Solve' to begin";
	} else if (current_worker_stats.is_running) {
		solve_stats_text = `${current_worker_stats.best_score} character(s) remaining, Time taken: ${PrettyPrintTimeTaken()}`;
	} else if (!current_worker_stats.is_running && current_worker_stats.best_score == current_solution_known_lowest_score) {
		if (current_worker_stats.best_score === 0) {
			solve_stats_text = `Solved in ${PrettyPrintTimeTaken()}`;
		} else {
			solve_stats_text = `Solved in ${PrettyPrintTimeTaken()} with ${current_solution_known_lowest_score} unusable character(s) leftover`;
		}
	} else if (!current_worker_stats.is_running && current_worker_stats.best_score > current_solution_known_lowest_score) {
		solve_stats_text = `Failed to solve in ${PrettyPrintTimeTaken()}, ${current_worker_stats.best_score} character(s) remaining`;
	}

	textSize(18);
	textAlign(LEFT, CENTER);
	fill(230);
	noStroke();
	text(solve_stats_text, 30, 30);

	textSize(32);
	textAlign(CENTER, CENTER);

	// Draw the solution (Grid + Letters)
	for (let y = 0; y < current_solution_to_draw.length; ++y) {
		for (let x = 0; x < current_solution_to_draw[y].length; ++x) {
			const char_to_draw = current_solution_to_draw[y][x];

			if (char_to_draw == NO_CHAR) {
				fill(30,30,30);

				// Draw the Grid Cell
				stroke(255,255,255);
				drawRect(offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2, cell_size, cell_size);
			} else {
				fill(30,200,30);

				// Draw the Grid Cell
				stroke(255,255,255);
				drawRect(offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2, cell_size, cell_size);

				// Draw the Letter in the Grid Cell
				fill(0,0,0);
				stroke(0,0,0);
				text(char_to_draw, offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2);
			}
		}
	}

	if (current_worker_stats.unused_letters.length > 0) {
		textSize(18);
		textAlign(LEFT, CENTER);
		fill(230);
		noStroke();
		text(`Unused letters: ${current_worker_stats.unused_letters}`, 30, offset_y + offset_y + cell_size*current_solution_to_draw.length - cell_size/2);
	}
}
